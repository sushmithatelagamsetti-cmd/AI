"""
Real-Time Fraud Detection: CNN + LSTM + Behavioral Model
Dataset: PaySim (preprocessed_dataset.csv)
Columns: step, type, amount, nameOrig, oldbalanceOrg, newbalanceOrig,
         nameDest, oldbalanceDest, newbalanceDest, isFraud, isFlaggedFraud
"""
import os
import numpy as np
import pandas as pd
import joblib
import json
import logging
from pathlib import Path
from typing import Tuple, Dict, Optional

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, Model
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau

from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import (classification_report, roc_auc_score,
                             confusion_matrix, f1_score, precision_score, recall_score)
from sklearn.ensemble import IsolationForest
from imblearn.over_sampling import SMOTE

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Paths ──────────────────────────────────────────────────────────────────
MODEL_DIR   = Path(os.getenv("MODEL_PATH", "./trained_models"))
DATA_PATH   = Path(os.getenv("DATA_PATH",  "./data/preprocessed_dataset.csv"))
MODEL_DIR.mkdir(parents=True, exist_ok=True)

SEQUENCE_LEN = 10   # steps per LSTM window
N_FEATURES   = 12   # engineered feature count


# ════════════════════════════════════════════════════════════════════════════
# 1. FEATURE ENGINEERING
# ════════════════════════════════════════════════════════════════════════════

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Create 12 ML-ready features from raw PaySim columns."""
    fe = pd.DataFrame()

    # Numeric raw
    fe["amount"]          = df["amount"]
    fe["oldbalanceOrg"]   = df["oldbalanceOrg"]
    fe["newbalanceOrig"]  = df["newbalanceOrig"]
    fe["oldbalanceDest"]  = df["oldbalanceDest"]
    fe["newbalanceDest"]  = df["newbalanceDest"]
    fe["step"]            = df["step"]

    # Derived balance signals
    fe["balance_diff_orig"] = df["oldbalanceOrg"]  - df["newbalanceOrig"]
    fe["balance_diff_dest"] = df["newbalanceDest"] - df["oldbalanceDest"]
    fe["amount_ratio_orig"] = df["amount"] / (df["oldbalanceOrg"]  + 1e-9)
    fe["amount_ratio_dest"] = df["amount"] / (df["oldbalanceDest"] + 1e-9)

    # Transaction type → ordinal (PAYMENT=0, TRANSFER=1, CASH_OUT=2, CASH_IN=3, DEBIT=4)
    type_map = {"PAYMENT": 0, "TRANSFER": 1, "CASH_OUT": 2, "CASH_IN": 3, "DEBIT": 4}
    fe["type_encoded"] = df["type"].map(type_map).fillna(0)

    # Merchant flag (destinations starting with M are merchants)
    fe["dest_is_merchant"] = df["nameDest"].str.startswith("M").astype(int)

    return fe


# ════════════════════════════════════════════════════════════════════════════
# 2. DATA LOADING
# ════════════════════════════════════════════════════════════════════════════

def load_data(path: Path, sample_frac: float = 0.3) -> Tuple[np.ndarray, np.ndarray, object]:
    """Load, engineer, scale. Returns X, y, scaler."""
    logger.info(f"Loading dataset from {path} …")

    # Lazy-load: read in chunks if file is huge
    if path.suffix == ".zip":
        import zipfile, io
        with zipfile.ZipFile(path) as z:
            csv_name = [n for n in z.namelist() if n.endswith(".csv")][0]
            with z.open(csv_name) as f:
                df = pd.read_csv(f)
    else:
        df = pd.read_csv(path)

    logger.info(f"Loaded {len(df):,} rows. Fraud rate: {df['isFraud'].mean():.4%}")

    # Optional down-sampling for speed during dev (keep all fraud rows)
    if sample_frac < 1.0:
        fraud     = df[df["isFraud"] == 1]
        non_fraud = df[df["isFraud"] == 0].sample(frac=sample_frac, random_state=42)
        df = pd.concat([fraud, non_fraud]).sample(frac=1, random_state=42).reset_index(drop=True)
        logger.info(f"After sampling: {len(df):,} rows (all {len(fraud)} fraud kept)")

    X_raw = engineer_features(df)
    y     = df["isFraud"].values

    scaler = StandardScaler()
    X = scaler.fit_transform(X_raw)

    return X, y, scaler, X_raw.columns.tolist()


# ════════════════════════════════════════════════════════════════════════════
# 3. SEQUENCE BUILDER  (for LSTM branch)
# ════════════════════════════════════════════════════════════════════════════

def build_sequences(X: np.ndarray, y: np.ndarray,
                    seq_len: int = SEQUENCE_LEN) -> Tuple[np.ndarray, np.ndarray]:
    """Slide a window of seq_len over sorted rows → (N, seq_len, features)."""
    Xs, ys = [], []
    for i in range(seq_len, len(X)):
        Xs.append(X[i - seq_len : i])
        ys.append(y[i])
    return np.array(Xs), np.array(ys)


# ════════════════════════════════════════════════════════════════════════════
# 4. MODEL ARCHITECTURES
# ════════════════════════════════════════════════════════════════════════════

def build_cnn_lstm_model(seq_len: int, n_features: int) -> Model:
    """
    CNN branch   → captures local spatial patterns in the feature window
    LSTM branch  → captures temporal dependencies across steps
    Both merged  → dense classification head
    """
    inp = keras.Input(shape=(seq_len, n_features), name="sequence_input")

    # ── CNN branch ──
    cnn = layers.Conv1D(64, kernel_size=3, activation="relu", padding="same")(inp)
    cnn = layers.BatchNormalization()(cnn)
    cnn = layers.Conv1D(128, kernel_size=3, activation="relu", padding="same")(cnn)
    cnn = layers.BatchNormalization()(cnn)
    cnn = layers.GlobalAveragePooling1D()(cnn)
    cnn = layers.Dropout(0.3)(cnn)

    # ── LSTM branch ──
    lstm = layers.LSTM(128, return_sequences=True)(inp)
    lstm = layers.Dropout(0.3)(lstm)
    lstm = layers.LSTM(64)(lstm)
    lstm = layers.Dropout(0.2)(lstm)

    # ── Merge ──
    merged = layers.Concatenate()([cnn, lstm])
    x = layers.Dense(128, activation="relu")(merged)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.4)(x)
    x = layers.Dense(64, activation="relu")(x)
    x = layers.Dropout(0.3)(x)
    out = layers.Dense(1, activation="sigmoid", name="fraud_prob")(x)

    model = Model(inputs=inp, outputs=out, name="CNN_LSTM_FraudDetector")
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss="binary_crossentropy",
        metrics=["accuracy",
                 keras.metrics.AUC(name="auc"),
                 keras.metrics.Precision(name="precision"),
                 keras.metrics.Recall(name="recall")]
    )
    return model


def build_behavioral_model(n_features: int) -> Model:
    """
    Fully-connected behavioral model — trained on per-transaction features
    without sequence context; acts as a fast first-pass scorer.
    """
    inp = keras.Input(shape=(n_features,), name="feature_input")
    x = layers.Dense(256, activation="relu")(inp)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.4)(x)
    x = layers.Dense(128, activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(64,  activation="relu")(x)
    x = layers.Dropout(0.2)(x)
    x = layers.Dense(32,  activation="relu")(x)
    out = layers.Dense(1, activation="sigmoid", name="behavioral_fraud_prob")(x)

    model = Model(inputs=inp, outputs=out, name="Behavioral_FraudDetector")
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=5e-4),
        loss="binary_crossentropy",
        metrics=["accuracy",
                 keras.metrics.AUC(name="auc"),
                 keras.metrics.Precision(name="precision"),
                 keras.metrics.Recall(name="recall")]
    )
    return model


# ════════════════════════════════════════════════════════════════════════════
# 5. TRAINING PIPELINE
# ════════════════════════════════════════════════════════════════════════════

def train_models(sample_frac: float = 0.3):
    """Full train pipeline: load → engineer → SMOTE → train both models → save."""
    # 5-a Load
    data_path = DATA_PATH
    if not data_path.exists():
        zip_path = data_path.parent / "preprocessed_dataset.zip"
        if zip_path.exists():
            data_path = zip_path
        else:
            raise FileNotFoundError(f"No dataset found at {DATA_PATH}")

    X, y, scaler, feature_names = load_data(data_path, sample_frac=sample_frac)
    logger.info(f"Features: {feature_names}")

    # 5-b Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # 5-c SMOTE on train set (handle class imbalance)
    logger.info("Applying SMOTE for class balance …")
    sm = SMOTE(random_state=42, k_neighbors=5)
    X_train_res, y_train_res = sm.fit_resample(X_train, y_train)
    logger.info(f"After SMOTE: {np.bincount(y_train_res)}")

    callbacks = [
        EarlyStopping(patience=5, restore_best_weights=True, monitor="val_auc", mode="max"),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, min_lr=1e-6),
    ]

    # ── Behavioral model ────────────────────────────────────────────────────
    logger.info("Training Behavioral (Dense) model …")
    beh_model = build_behavioral_model(N_FEATURES)
    beh_model.fit(
        X_train_res, y_train_res,
        validation_data=(X_test, y_test),
        epochs=30, batch_size=512,
        callbacks=callbacks,
        class_weight={0: 1, 1: 3},   # extra penalty for missing fraud
        verbose=1
    )
    beh_model.save(MODEL_DIR / "behavioral_model.keras")
    logger.info("Behavioral model saved.")

    # ── CNN+LSTM model ───────────────────────────────────────────────────────
    logger.info("Building sequences for CNN+LSTM …")
    X_seq,  y_seq  = build_sequences(X,       y)
    X_tr_s, X_te_s, y_tr_s, y_te_s = train_test_split(
        X_seq, y_seq, test_size=0.2, random_state=42, stratify=y_seq
    )
    sm2 = SMOTE(random_state=42, k_neighbors=3)
    n, t, f = X_tr_s.shape
    X_tr_flat, y_tr_s2 = sm2.fit_resample(X_tr_s.reshape(n, -1), y_tr_s)
    X_tr_s2 = X_tr_flat.reshape(-1, t, f)

    logger.info("Training CNN+LSTM model …")
    cnn_lstm = build_cnn_lstm_model(SEQUENCE_LEN, N_FEATURES)
    cnn_lstm.fit(
        X_tr_s2, y_tr_s2,
        validation_data=(X_te_s, y_te_s),
        epochs=30, batch_size=256,
        callbacks=callbacks,
        class_weight={0: 1, 1: 3},
        verbose=1
    )
    cnn_lstm.save(MODEL_DIR / "cnn_lstm_model.keras")
    logger.info("CNN+LSTM model saved.")

    # ── Isolation Forest (anomaly baseline) ─────────────────────────────────
    logger.info("Training Isolation Forest …")
    iso = IsolationForest(n_estimators=200, contamination=0.01, random_state=42, n_jobs=-1)
    iso.fit(X_train)
    joblib.dump(iso, MODEL_DIR / "isolation_forest.pkl")

    # ── Persist scaler + meta ────────────────────────────────────────────────
    joblib.dump(scaler, MODEL_DIR / "scaler.pkl")
    meta = {
        "feature_names": feature_names,
        "sequence_len":  SEQUENCE_LEN,
        "n_features":    N_FEATURES,
    }
    with open(MODEL_DIR / "model_meta.json", "w") as fh:
        json.dump(meta, fh, indent=2)

    # ── Evaluation ──────────────────────────────────────────────────────────
    logger.info("=== Evaluation on hold-out test set ===")

    beh_probs = beh_model.predict(X_test, verbose=0).ravel()
    beh_preds = (beh_probs > 0.5).astype(int)
    logger.info("\n[Behavioral Model]\n" + classification_report(y_test, beh_preds, digits=4))
    logger.info(f"AUC-ROC: {roc_auc_score(y_test, beh_probs):.4f}")

    seq_probs = cnn_lstm.predict(X_te_s, verbose=0).ravel()
    seq_preds = (seq_probs > 0.5).astype(int)
    logger.info("\n[CNN+LSTM Model]\n" + classification_report(y_te_s, seq_preds, digits=4))
    logger.info(f"AUC-ROC: {roc_auc_score(y_te_s, seq_probs):.4f}")

    # Save metrics
    metrics = {
        "behavioral": {
            "accuracy":  float(np.mean(beh_preds == y_test)),
            "precision": float(precision_score(y_test, beh_preds, zero_division=0)),
            "recall":    float(recall_score(y_test, beh_preds, zero_division=0)),
            "f1_score":  float(f1_score(y_test, beh_preds, zero_division=0)),
            "auc_roc":   float(roc_auc_score(y_test, beh_probs)),
        },
        "cnn_lstm": {
            "accuracy":  float(np.mean(seq_preds == y_te_s)),
            "precision": float(precision_score(y_te_s, seq_preds, zero_division=0)),
            "recall":    float(recall_score(y_te_s, seq_preds, zero_division=0)),
            "f1_score":  float(f1_score(y_te_s, seq_preds, zero_division=0)),
            "auc_roc":   float(roc_auc_score(y_te_s, seq_probs)),
        },
    }
    with open(MODEL_DIR / "metrics.json", "w") as fh:
        json.dump(metrics, fh, indent=2)
    logger.info(f"Metrics saved to {MODEL_DIR}/metrics.json")
    logger.info("Training complete ✓")
    return metrics


# ════════════════════════════════════════════════════════════════════════════
# 6. INFERENCE ENGINE
# ════════════════════════════════════════════════════════════════════════════

class FraudDetector:
    """Singleton inference engine loaded once at startup."""

    def __init__(self):
        self.behavioral_model: Optional[Model] = None
        self.cnn_lstm_model:   Optional[Model] = None
        self.iso_forest:       Optional[IsolationForest] = None
        self.scaler:           Optional[StandardScaler]  = None
        self.feature_names:    list = []
        self.sequence_len:     int  = SEQUENCE_LEN
        self._history:         list = []   # rolling window for LSTM
        self.loaded = False

    def load(self):
        try:
            self.behavioral_model = keras.models.load_model(MODEL_DIR / "behavioral_model.keras")
            self.cnn_lstm_model   = keras.models.load_model(MODEL_DIR / "cnn_lstm_model.keras")
            self.iso_forest       = joblib.load(MODEL_DIR / "isolation_forest.pkl")
            self.scaler           = joblib.load(MODEL_DIR / "scaler.pkl")
            with open(MODEL_DIR / "model_meta.json") as fh:
                meta = json.load(fh)
            self.feature_names = meta["feature_names"]
            self.sequence_len  = meta["sequence_len"]
            self.loaded = True
            logger.info("All models loaded successfully ✓")
        except FileNotFoundError as e:
            logger.warning(f"Models not found ({e}). Run train_models() first.")

    def _extract_features(self, tx: dict) -> np.ndarray:
        """Convert a single transaction dict → scaled feature vector."""
        type_map = {"PAYMENT": 0, "TRANSFER": 1, "CASH_OUT": 2, "CASH_IN": 3, "DEBIT": 4}
        raw = {
            "amount":           tx.get("amount", 0),
            "oldbalanceOrg":    tx.get("old_balance_orig", 0),
            "newbalanceOrig":   tx.get("new_balance_orig", 0),
            "oldbalanceDest":   tx.get("old_balance_dest", 0),
            "newbalanceDest":   tx.get("new_balance_dest", 0),
            "step":             tx.get("step", 0),
            "balance_diff_orig": tx.get("old_balance_orig", 0) - tx.get("new_balance_orig", 0),
            "balance_diff_dest": tx.get("new_balance_dest", 0) - tx.get("old_balance_dest", 0),
            "amount_ratio_orig": tx.get("amount", 0) / (tx.get("old_balance_orig", 0) + 1e-9),
            "amount_ratio_dest": tx.get("amount", 0) / (tx.get("old_balance_dest", 0) + 1e-9),
            "type_encoded":     type_map.get(tx.get("type", "PAYMENT"), 0),
            "dest_is_merchant": 1 if str(tx.get("name_dest", "")).startswith("M") else 0,
        }
        vec = np.array([raw[k] for k in self.feature_names], dtype=np.float32).reshape(1, -1)
        return self.scaler.transform(vec)

    def predict(self, tx: dict) -> Dict:
        """
        Returns a full prediction dict with scores from all three models.
        Ensemble: 40% CNN+LSTM + 40% Behavioral + 20% Isolation Forest
        """
        if not self.loaded:
            # Fallback rule-based score when models aren't trained yet
            return self._rule_based_fallback(tx)

        feat_vec = self._extract_features(tx)   # shape (1, 12)

        # ── Behavioral score ────────────────────────────────────────────────
        beh_prob = float(self.behavioral_model.predict(feat_vec, verbose=0)[0][0])

        # ── Isolation Forest (anomaly) ───────────────────────────────────────
        iso_score_raw = self.iso_forest.score_samples(feat_vec)[0]  # negative; more negative = more anomalous
        # Normalize to [0,1]: typical range is [-0.5, 0]
        iso_prob = float(np.clip((-iso_score_raw - 0.0) / 0.5, 0, 1))

        # ── CNN+LSTM score (needs sequence) ──────────────────────────────────
        self._history.append(feat_vec[0])
        if len(self._history) > self.sequence_len:
            self._history = self._history[-self.sequence_len:]

        if len(self._history) == self.sequence_len:
            seq = np.array(self._history, dtype=np.float32)[np.newaxis, ...]  # (1, 10, 12)
            cnn_lstm_prob = float(self.cnn_lstm_model.predict(seq, verbose=0)[0][0])
        else:
            cnn_lstm_prob = beh_prob  # fallback until window is full

        # ── Ensemble risk score (0-100) ──────────────────────────────────────
        ensemble = 0.40 * cnn_lstm_prob + 0.40 * beh_prob + 0.20 * iso_prob
        risk_score = round(ensemble * 100, 2)

        is_fraud = risk_score >= 60
        if risk_score >= 75:
            status = "BLOCKED"
        elif risk_score >= 50:
            status = "FLAGGED"
        else:
            status = "APPROVED"

        return {
            "is_fraud_predicted": is_fraud,
            "risk_score":         risk_score,
            "cnn_score":          round(cnn_lstm_prob * 100, 2),
            "lstm_score":         round(cnn_lstm_prob * 100, 2),   # same model outputs both
            "behavioral_score":   round(beh_prob * 100, 2),
            "status":             status,
            "confidence":         round(max(ensemble, 1 - ensemble) * 100, 2),
            "explanation": {
                "high_amount":       tx.get("amount", 0) > 200_000,
                "balance_zeroed":    tx.get("new_balance_orig", -1) == 0 and tx.get("old_balance_orig", 0) > 0,
                "risky_type":        tx.get("type") in ("TRANSFER", "CASH_OUT"),
                "behavioral_flag":   beh_prob > 0.5,
                "anomaly_flag":      iso_prob > 0.6,
                "cnn_lstm_flag":     cnn_lstm_prob > 0.5,
            },
        }

    def _rule_based_fallback(self, tx: dict) -> Dict:
        """Simple heuristic when model files are missing."""
        score = 0.0
        if tx.get("type") in ("TRANSFER", "CASH_OUT"):
            score += 20
        if tx.get("amount", 0) > 200_000:
            score += 20
        if tx.get("new_balance_orig", 1) == 0 and tx.get("old_balance_orig", 0) > 0:
            score += 30
        if tx.get("old_balance_dest", 0) == 0:
            score += 10

        risk_score = min(score, 100)
        status = "BLOCKED" if risk_score >= 75 else "FLAGGED" if risk_score >= 50 else "APPROVED"
        return {
            "is_fraud_predicted": risk_score >= 50,
            "risk_score": risk_score,
            "cnn_score": risk_score * 0.8,
            "lstm_score": risk_score * 0.9,
            "behavioral_score": risk_score,
            "status": status,
            "confidence": 65.0,
            "explanation": {"rule_based": True},
        }


# Singleton
detector = FraudDetector()


if __name__ == "__main__":
    train_models(sample_frac=0.3)
