
from io import BytesIO
from math import ceil
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Aether API",
    description="Network Anomaly Intelligence",
    version="0.4.0",
)

# main.py is inside backend; the model is inside backend/models.
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "aether_model.joblib"

MAX_FILE_SIZE = 50 * 1024 * 1024
MAX_FLAGGED_RECORDS = 200
CHART_BATCHES = 12

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_model_bundle():
    print(f"Aether model path: {MODEL_PATH}")
    print(f"Model file exists: {MODEL_PATH.is_file()}")

    if not MODEL_PATH.is_file():
        print("ERROR: Model file was not found.")
        return None

    try:
        bundle = joblib.load(MODEL_PATH)
        print("Aether model loaded successfully.")
        return bundle
    except Exception as exc:
        print(
            f"ERROR loading Aether model: "
            f"{type(exc).__name__}: {exc}"
        )
        return None


model_bundle = load_model_bundle()


def json_safe_records(dataframe):
    """Convert pandas missing values and NumPy scalars to JSON-safe values."""
    clean = dataframe.astype(object).where(pd.notna(dataframe), None)
    return clean.to_dict(orient="records")


def make_traffic_summary(results):
    """Count normal-looking and flagged rows in consecutive row batches."""
    total = len(results)
    batch_size = max(1, ceil(total / CHART_BATCHES))
    summary = []

    for start in range(0, total, batch_size):
        end = min(start + batch_size, total)
        batch = results.iloc[start:end]

        summary.append({
            "time": f"Rows {start + 1:,}–{end:,}",
            "normal": int((~batch["anomaly"]).sum()),
            "flagged": int(batch["anomaly"].sum()),
        })

    return summary


def make_protocol_summary(dataframe, results):
    """Summarize actual protocol counts and flagged counts."""
    if "proto" not in dataframe.columns:
        return []

    protocol_names = (
        dataframe["proto"]
        .fillna("Unknown")
        .astype(str)
        .str.upper()
    )

    counts = protocol_names.value_counts()
    top_protocols = counts.head(5).index.tolist()

    summary = []

    for protocol in top_protocols:
        mask = protocol_names == protocol
        summary.append({
            "name": protocol,
            "value": int(mask.sum()),
            "flagged": int(results.loc[mask, "anomaly"].sum()),
        })

    other_mask = ~protocol_names.isin(top_protocols)

    if other_mask.any():
        summary.append({
            "name": "OTHER",
            "value": int(other_mask.sum()),
            "flagged": int(results.loc[other_mask, "anomaly"].sum()),
        })

    return summary


@app.get("/")
def root():
    return {
        "app": "Aether",
        "message": "Network Anomaly Intelligence API",
        "docs": "/docs",
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": "Aether",
        "model_loaded": model_bundle is not None,
    }


def prepare_features(dataframe: pd.DataFrame, bundle: dict) -> pd.DataFrame:
    """Prepare and validate model input features from an uploaded dataframe.

    - Matches the trained model's expected feature set and column order.
    - Missing features are populated with NaN so the model's fitted preprocessing
      pipeline (SimpleImputer: median for numeric, mode for categorical) can impute
      them according to the training distribution.
    - Extra columns are excluded from model inputs while remaining preserved in the dataframe.
    - Validates data types and catches invalid non-numeric/infinite values or
      unsupported complex objects, raising an HTTP 400 error.
    - Requires at least one recognizable model feature to prevent evaluating
      completely synthetic records without any observed network data.
    """
    feature_columns = bundle["feature_columns"]
    numeric_columns = set(bundle.get("numeric_columns", []))
    categorical_columns = set(bundle.get("categorical_columns", []))

    present_features = [
        col for col in feature_columns if col in dataframe.columns
    ]
    if not present_features:
        raise HTTPException(
            status_code=400,
            detail={
                "message": (
                    "Uploaded CSV does not contain any recognized model features. "
                    "At least one model feature must be present to evaluate records."
                ),
                "expected_feature_count": len(feature_columns),
            },
        )

    prepared_data = {}
    invalid_columns = {}

    for col in feature_columns:
        if col in dataframe.columns:
            series = dataframe[col]
            if isinstance(series, pd.DataFrame):
                series = series.iloc[:, 0]

            if col in numeric_columns:
                if series.dtype == bool:
                    numeric_series = series.astype(float)
                else:
                    numeric_series = pd.to_numeric(series, errors="coerce")

                invalid_mask = series.notna() & (
                    numeric_series.isna() | np.isinf(numeric_series)
                )
                if invalid_mask.any():
                    sample_invalids = series[invalid_mask].head(3).tolist()
                    invalid_columns[col] = (
                        f"Expected numeric values, but found invalid entries: {sample_invalids}"
                    )
                else:
                    prepared_data[col] = numeric_series
            elif col in categorical_columns:
                cleaned_values = []
                has_invalid = False
                for val in series:
                    if pd.isna(val):
                        cleaned_values.append(np.nan)
                    elif isinstance(val, (dict, list, set, bytearray)):
                        has_invalid = True
                        break
                    else:
                        cleaned_values.append(str(val))

                if has_invalid:
                    invalid_columns[col] = (
                        "Expected scalar or categorical values, but found unsupported complex structures."
                    )
                else:
                    prepared_data[col] = pd.Series(
                        cleaned_values, index=dataframe.index, dtype=object
                    )
            else:
                prepared_data[col] = series
        else:
            # Missing feature: assign np.nan to be imputed by the training pipeline
            prepared_data[col] = np.full(len(dataframe), np.nan)

    if invalid_columns:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "CSV contains invalid values or unsupported data types.",
                "invalid_columns": list(invalid_columns.keys()),
                "errors": invalid_columns,
            },
        )

    missing_features = [
        col for col in feature_columns if col not in dataframe.columns
    ]
    extra_features = [
        col for col in dataframe.columns if col not in feature_columns
    ]

    imputed_count = 0
    non_finite_count = 0

    for col in feature_columns:
        if col in dataframe.columns:
            series = dataframe[col]
            if isinstance(series, pd.DataFrame):
                series = series.iloc[:, 0]
            if col in numeric_columns:
                num = pd.to_numeric(series, errors="coerce")
                imputed_count += int(num.isna().sum())
                non_finite_count += int(np.isinf(num).sum())
            elif col in categorical_columns:
                imputed_count += int(series.isna().sum())
        else:
            imputed_count += len(dataframe)

    print(
        f"[ANALYSIS] Feature validation diagnostics: "
        f"missing_features={len(missing_features)}, "
        f"extra_features={len(extra_features)}, "
        f"imputed_values={imputed_count}, "
        f"non_finite_numeric_values={non_finite_count}"
    )

    return pd.DataFrame(
        prepared_data, index=dataframe.index, columns=feature_columns
    )


@app.post("/api/analyze-csv")
async def analyze_csv(file: UploadFile = File(...)):
    if model_bundle is None:
        raise HTTPException(
            status_code=503,
            detail="Model is not loaded. Train the model first.",
        )

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a CSV file.",
        )

    try:
        content = await file.read(MAX_FILE_SIZE + 1)

        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="File exceeds the 50 MB limit.",
            )

        if not content:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty.",
            )

        try:
            dataframe = pd.read_csv(BytesIO(content))
        except (
            pd.errors.ParserError,
            UnicodeDecodeError,
            ValueError,
        ):
            raise HTTPException(
                status_code=400,
                detail="Could not read this CSV. Check its format.",
            )

        if dataframe.empty:
            raise HTTPException(
                status_code=400,
                detail="The CSV contains no data rows.",
            )

        features = prepare_features(dataframe, model_bundle)
        model = model_bundle["model"]

        predictions = model.predict(features)
        anomaly_scores = -model.decision_function(features)

        results = dataframe.copy()
        results["anomaly"] = predictions == -1
        results["anomaly_score"] = anomaly_scores

        total_count = len(dataframe)
        flagged_count = int((predictions == -1).sum())
        normal_count = total_count - flagged_count

        print(
            f"[ANALYSIS] Prediction summary: records={total_count}, "
            f"anomalies={flagged_count}, normal={normal_count}, "
            f"anomaly_score_range=[{anomaly_scores.min():.4f}, {anomaly_scores.max():.4f}]"
        )

        # Include row numbers so records remain identifiable even without IDs.
        if "record_number" in results.columns:
            results["record_number"] = range(1, total_count + 1)
        else:
            results.insert(
                0,
                "record_number",
                range(1, total_count + 1),
            )

        # Return only a bounded subset of flagged records to avoid
        # sending a very large response to the browser.
        flagged = results.loc[results["anomaly"]].head(
            MAX_FLAGGED_RECORDS
        )

        return {
            "status": "success",
            "filename": file.filename,
            "total_records": total_count,
            "anomalies_detected": flagged_count,
            "normal_records": normal_count,
            "anomaly_rate": round(
                flagged_count / total_count * 100, 2
            ),
            "traffic_summary": make_traffic_summary(results),
            "protocol_summary": make_protocol_summary(
                dataframe, results
            ),
            "results": json_safe_records(results.head(10)),
            "flagged_records": json_safe_records(flagged),
            "flagged_records_returned": len(flagged),
            "flagged_records_truncated": (
                flagged_count > MAX_FLAGGED_RECORDS
            ),
            "message": (
                "Anomaly screening complete. Flagged records "
                "require investigation; they are not confirmed attacks."
            ),
        }

    finally:
        await file.close()
