
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


# Paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent / "data"
MODEL_DIR = BASE_DIR / "models"

TRAIN_FILE = DATA_DIR / "UNSW_NB15_training-set.csv"
TEST_FILE = DATA_DIR / "UNSW_NB15_testing-set.csv"
MODEL_FILE = MODEL_DIR / "aether_model.joblib"

RANDOM_STATE = 42


def main():
    # 1. Check the dataset files
    if not TRAIN_FILE.exists() or not TEST_FILE.exists():
        raise FileNotFoundError(
            "Training or testing CSV not found in the data folder."
        )

    print("Loading datasets...")
    train_df = pd.read_csv(TRAIN_FILE, low_memory=False)
    test_df = pd.read_csv(TEST_FILE, low_memory=False)

    required_columns = {"label", "attack_cat", "id"}
    for name, df in [("training", train_df), ("testing", test_df)]:
        missing = required_columns - set(df.columns)
        if missing:
            raise ValueError(
                f"{name} dataset is missing columns: {sorted(missing)}"
            )

    # 2. Keep only normal records for model training.
    # Labels are used to select training rows, never as input features.
    normal_train = train_df[
        (train_df["label"] == 0)
        & (train_df["attack_cat"].astype(str).str.strip().str.lower()
           == "normal")
    ].copy()

    if normal_train.empty:
        raise ValueError("No normal training records were found.")

    # Exclude identifiers and target/label columns.
    excluded = {"id", "label", "attack_cat"}
    feature_columns = [
        col for col in train_df.columns if col not in excluded
    ]

    X_train = normal_train[feature_columns].copy()
    X_test = test_df[feature_columns].copy()

    # Ensure the testing dataset has compatible features.
    if list(X_train.columns) != list(X_test.columns):
        raise ValueError(
            "Training and testing feature columns do not match."
        )

    # 3. Identify numeric and categorical columns.
    categorical_columns = X_train.select_dtypes(
        include=["object", "category", "string"]
    ).columns.tolist()
    numeric_columns = [
        col for col in feature_columns
        if col not in categorical_columns
    ]

    print(f"Training rows available: {len(train_df):,}")
    print(f"Normal rows used for training: {len(normal_train):,}")
    print(f"Testing rows: {len(test_df):,}")
    print(f"Numeric features: {len(numeric_columns)}")
    print(f"Categorical features: {len(categorical_columns)}")

    # 4. Prepare numeric and categorical features.
    numeric_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
    ])

    categorical_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(handle_unknown="ignore")),
    ])

    preprocessor = ColumnTransformer([
        ("numeric", numeric_pipeline, numeric_columns),
        ("categorical", categorical_pipeline, categorical_columns),
    ])

    # 5. Build and train the Isolation Forest pipeline.
    model = Pipeline([
        ("preprocessor", preprocessor),
        (
            "detector",
            IsolationForest(
                n_estimators=150,
                contamination="auto",
                random_state=RANDOM_STATE,
                n_jobs=-1,
            ),
        ),
    ])

    print("\nTraining Isolation Forest...")
    model.fit(X_train)
    print("Training complete!")

    # 6. Evaluate on the separate testing dataset.
    # UNSW-NB15 label: 0 = normal, 1 = attack.
    y_true = test_df["label"].astype(int)

    print("\nScoring testing data...")
    predictions = model.predict(X_test)
    y_pred = (predictions == -1).astype(int)

    # Higher scores indicate greater anomaly-ness.
    anomaly_scores = -model.decision_function(X_test)

    print("\nClassification report (1 = attack/anomaly):")
    print(
        classification_report(
            y_true,
            y_pred,
            labels=[0, 1],
            target_names=["Normal", "Attack"],
            zero_division=0,
        )
    )

    print("Confusion matrix (rows = actual, columns = predicted):")
    print(confusion_matrix(y_true, y_pred, labels=[0, 1]))

    if y_true.nunique() == 2:
        auc = roc_auc_score(y_true, anomaly_scores)
        print(f"\nROC-AUC: {auc:.4f}")

    print(f"Actual attack rate in test data: {y_true.mean():.2%}")
    print(f"Predicted anomaly rate: {y_pred.mean():.2%}")

    # 7. Save the complete pipeline for the API.
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    joblib.dump(
        {
            "model": model,
            "feature_columns": feature_columns,
            "numeric_columns": numeric_columns,
            "categorical_columns": categorical_columns,
            "algorithm": "IsolationForest",
        },
        MODEL_FILE,
    )

    print(f"\nSaved model to: {MODEL_FILE}")
    print("Aether's trained model is ready to integrate with the API.")


if __name__ == "__main__":
    main()
