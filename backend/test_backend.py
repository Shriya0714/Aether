"""Comprehensive test suite for Aether backend CSV feature validation and preprocessing.

Tests all required scenarios:
1. All required features present in the correct order.
2. All required features present in a different order.
3. Extra unrelated columns.
4. One or more missing required features.
5. Multiple missing features.
6. Missing features requiring categorical preprocessing.
7. Invalid values or unsupported data types.
8. Empty CSVs and malformed CSVs.
9. A CSV containing both missing and extra columns.
"""

import asyncio
from io import BytesIO
import unittest
import numpy as np
import pandas as pd
from fastapi import HTTPException, UploadFile

from main import analyze_csv, model_bundle, prepare_features


def run_async(coro):
    return asyncio.run(coro)


class TestCSVAnalysis(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bundle = model_bundle
        assert cls.bundle is not None, "Model bundle must be loaded for tests."
        cls.feature_columns = cls.bundle["feature_columns"]
        cls.numeric_columns = cls.bundle["numeric_columns"]
        cls.categorical_columns = cls.bundle["categorical_columns"]

        # Base sample record with all 42 required features
        cls.sample_record = {}
        for col in cls.feature_columns:
            if col in cls.categorical_columns:
                cls.sample_record[col] = "tcp" if col == "proto" else ("http" if col == "service" else "FIN")
            else:
                cls.sample_record[col] = 1.0

    def create_upload_file(self, content_str: str, filename: str = "test.csv") -> UploadFile:
        return UploadFile(filename=filename, file=BytesIO(content_str.encode("utf-8")))

    def test_01_all_required_features_correct_order(self):
        """1. All required features present in the correct order."""
        df = pd.DataFrame([self.sample_record, self.sample_record])
        csv_str = df.to_csv(index=False)
        upload = self.create_upload_file(csv_str)

        res = run_async(analyze_csv(upload))

        self.assertEqual(res["status"], "success")
        self.assertEqual(res["total_records"], 2)
        self.assertIn("anomalies_detected", res)
        self.assertIn("normal_records", res)
        self.assertIn("anomaly_rate", res)
        self.assertIn("traffic_summary", res)
        self.assertIn("protocol_summary", res)
        self.assertIn("results", res)
        self.assertIn("flagged_records", res)
        self.assertEqual(len(res["results"]), 2)

        # Verify model input features
        features = prepare_features(df, self.bundle)
        self.assertEqual(list(features.columns), self.feature_columns)
        self.assertEqual(features.shape, (2, 42))

    def test_02_all_required_features_different_order(self):
        """2. All required features present in a different order."""
        reversed_cols = list(reversed(self.feature_columns))
        df = pd.DataFrame([self.sample_record, self.sample_record])[reversed_cols]
        csv_str = df.to_csv(index=False)
        upload = self.create_upload_file(csv_str)

        res = run_async(analyze_csv(upload))

        self.assertEqual(res["status"], "success")
        self.assertEqual(res["total_records"], 2)

        # Verify features are aligned to the saved feature order
        features = prepare_features(df, self.bundle)
        self.assertEqual(list(features.columns), self.feature_columns)
        self.assertEqual(features.shape, (2, 42))

    def test_03_extra_unrelated_columns(self):
        """3. Extra unrelated columns."""
        record_with_extras = dict(self.sample_record)
        record_with_extras["client_ip"] = "192.168.1.100"
        record_with_extras["user_id"] = "agent_42"
        record_with_extras["custom_tag"] = "test_run"

        df = pd.DataFrame([record_with_extras])
        csv_str = df.to_csv(index=False)
        upload = self.create_upload_file(csv_str)

        res = run_async(analyze_csv(upload))

        self.assertEqual(res["status"], "success")
        # Ensure extra columns are preserved in output records
        self.assertEqual(res["results"][0]["client_ip"], "192.168.1.100")
        self.assertEqual(res["results"][0]["user_id"], "agent_42")
        self.assertEqual(res["results"][0]["custom_tag"], "test_run")

        # Verify model input features do not include extra columns
        features = prepare_features(df, self.bundle)
        self.assertEqual(list(features.columns), self.feature_columns)
        self.assertNotIn("client_ip", features.columns)
        self.assertEqual(features.shape, (1, 42))

    def test_04_one_or_more_missing_required_features(self):
        """4. One or more missing required features."""
        record_missing = dict(self.sample_record)
        del record_missing["dur"]
        del record_missing["spkts"]

        df = pd.DataFrame([record_missing])
        csv_str = df.to_csv(index=False)
        upload = self.create_upload_file(csv_str)

        res = run_async(analyze_csv(upload))

        self.assertEqual(res["status"], "success")
        self.assertEqual(res["total_records"], 1)

        # In prepared features, missing features must be present as NaN
        features = prepare_features(df, self.bundle)
        self.assertEqual(features.shape, (1, 42))
        self.assertTrue(np.isnan(features.loc[0, "dur"]))
        self.assertTrue(np.isnan(features.loc[0, "spkts"]))

    def test_05_multiple_missing_features(self):
        """5. Multiple missing features (over 20 missing)."""
        # Keep only 5 features
        subset = {
            "dur": 0.05,
            "proto": "tcp",
            "service": "http",
            "state": "FIN",
            "sbytes": 500,
        }
        df = pd.DataFrame([subset, subset])
        csv_str = df.to_csv(index=False)
        upload = self.create_upload_file(csv_str)

        res = run_async(analyze_csv(upload))

        self.assertEqual(res["status"], "success")
        self.assertEqual(res["total_records"], 2)

        features = prepare_features(df, self.bundle)
        self.assertEqual(features.shape, (2, 42))
        self.assertEqual(list(features.columns), self.feature_columns)

    def test_06_missing_features_requiring_categorical_preprocessing(self):
        """6. Missing features requiring categorical preprocessing."""
        # Remove all categorical features: proto, service, state
        record_no_cat = dict(self.sample_record)
        del record_no_cat["proto"]
        del record_no_cat["service"]
        del record_no_cat["state"]

        df = pd.DataFrame([record_no_cat, record_no_cat])
        csv_str = df.to_csv(index=False)
        upload = self.create_upload_file(csv_str)

        res = run_async(analyze_csv(upload))

        self.assertEqual(res["status"], "success")
        self.assertEqual(res["total_records"], 2)

        # Categorical columns in features must be NaN for pipeline imputation
        features = prepare_features(df, self.bundle)
        self.assertTrue(pd.isna(features.loc[0, "proto"]))
        self.assertTrue(pd.isna(features.loc[0, "service"]))
        self.assertTrue(pd.isna(features.loc[0, "state"]))

        # Verify pipeline transforms them without error
        model = self.bundle["model"]
        preds = model.predict(features)
        self.assertEqual(len(preds), 2)

    def test_07_invalid_values_or_unsupported_data_types(self):
        """7. Invalid values or unsupported data types produce HTTP 400."""
        # 7a. Non-numeric string in numeric column
        bad_numeric = dict(self.sample_record)
        bad_numeric["dur"] = "invalid_not_a_number"
        df = pd.DataFrame([bad_numeric])
        upload = self.create_upload_file(df.to_csv(index=False))

        with self.assertRaises(HTTPException) as ctx:
            run_async(analyze_csv(upload))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("invalid", str(ctx.exception.detail).lower())

        # 7b. Infinity in numeric column
        inf_record = dict(self.sample_record)
        inf_record["sbytes"] = np.inf
        df_inf = pd.DataFrame([inf_record])
        upload_inf = self.create_upload_file(df_inf.to_csv(index=False))

        with self.assertRaises(HTTPException) as ctx:
            run_async(analyze_csv(upload_inf))
        self.assertEqual(ctx.exception.status_code, 400)

        # 7c. Nested dictionary in categorical column
        df_nested = pd.DataFrame([{"proto": {"nested": "dict"}, "dur": 0.1}])
        with self.assertRaises(HTTPException) as ctx:
            prepare_features(df_nested, self.bundle)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_08_empty_and_malformed_csvs(self):
        """8. Empty CSVs and malformed CSVs produce HTTP 400."""
        # 8a. Completely empty file (0 bytes)
        upload_empty = self.create_upload_file("")
        with self.assertRaises(HTTPException) as ctx:
            run_async(analyze_csv(upload_empty))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("empty", str(ctx.exception.detail).lower())

        # 8b. Header only, 0 data rows
        upload_no_rows = self.create_upload_file("dur,proto,service\n")
        with self.assertRaises(HTTPException) as ctx:
            run_async(analyze_csv(upload_no_rows))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("no data rows", str(ctx.exception.detail).lower())

        # 8c. Unparseable malformed CSV
        malformed = 'col1,col2\n"unclosed quote,123\n456'
        upload_malformed = self.create_upload_file(malformed)
        with self.assertRaises(HTTPException) as ctx:
            run_async(analyze_csv(upload_malformed))
        self.assertEqual(ctx.exception.status_code, 400)

        # 8d. Zero recognized model features (only unrelated columns)
        unrelated = pd.DataFrame([{"user_name": "alice", "score": 99}])
        upload_unrelated = self.create_upload_file(unrelated.to_csv(index=False))
        with self.assertRaises(HTTPException) as ctx:
            run_async(analyze_csv(upload_unrelated))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("recognized", str(ctx.exception.detail).lower())

    def test_09_csv_with_both_missing_and_extra_columns(self):
        """9. A CSV containing both missing and extra columns."""
        hybrid_record = {
            "dur": 0.04,
            "proto": "udp",
            "sbytes": 350,
            # Extra columns:
            "destination_ip": "10.0.0.1",
            "firewall_zone": "internal",
            "session_id": "sess-999",
        }
        df = pd.DataFrame([hybrid_record, hybrid_record])
        csv_str = df.to_csv(index=False)
        upload = self.create_upload_file(csv_str)

        res = run_async(analyze_csv(upload))

        self.assertEqual(res["status"], "success")
        self.assertEqual(res["total_records"], 2)
        # Extra columns preserved
        self.assertEqual(res["results"][0]["destination_ip"], "10.0.0.1")
        self.assertEqual(res["results"][0]["firewall_zone"], "internal")
        self.assertEqual(res["results"][0]["session_id"], "sess-999")

        # Model input shape & order
        features = prepare_features(df, self.bundle)
        self.assertEqual(features.shape, (2, 42))
        self.assertEqual(list(features.columns), self.feature_columns)
        self.assertNotIn("destination_ip", features.columns)

    def test_10_csv_with_preexisting_record_number_column(self):
        """CSV containing a pre-existing 'record_number' column does not crash."""
        record = dict(self.sample_record)
        record["record_number"] = 9999
        df = pd.DataFrame([record])
        upload = self.create_upload_file(df.to_csv(index=False))

        res = run_async(analyze_csv(upload))
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["results"][0]["record_number"], 1)

    def test_11_mock_bundle_features_preparation(self):
        """Test prepare_features with a custom mock bundle."""
        mock_bundle = {
            "feature_columns": ["col_b", "col_a", "col_cat"],
            "numeric_columns": ["col_b", "col_a"],
            "categorical_columns": ["col_cat"],
        }
        # Uploaded data has extra col 'col_z', missing 'col_a', and reversed order
        raw_df = pd.DataFrame([
            {"col_cat": "web", "col_b": 42.0, "col_z": "irrelevant"},
            {"col_cat": "db", "col_b": 100.5, "col_z": "also_irrelevant"},
        ])
        prepared = prepare_features(raw_df, mock_bundle)

        # Columns match mock bundle order exactly
        self.assertEqual(list(prepared.columns), ["col_b", "col_a", "col_cat"])
        # Extra column excluded
        self.assertNotIn("col_z", prepared.columns)
        # Missing column populated with NaN
        self.assertTrue(prepared["col_a"].isna().all())
        # Values preserved
        self.assertEqual(prepared.loc[0, "col_b"], 42.0)
        self.assertEqual(prepared.loc[0, "col_cat"], "web")


if __name__ == "__main__":
    unittest.main()
