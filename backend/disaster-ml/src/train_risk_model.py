import argparse
from pathlib import Path
from datetime import datetime

import joblib
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


# ============================================================
# CONFIGURATION
# ============================================================

TARGET = "risk_label"

FEATURES = [
    "district",
    "affected_villages",
    "population_affected",
    "crop_area_affected_ha",
    "landslide_area_ha",
    "roads_damaged",
    "houses_damaged",
    "lives_lost",
    "rainfall_mm",
    "river_danger_level_count",
    "historical_hazard_score",
]

NUMERIC_FEATURES = [
    "affected_villages",
    "population_affected",
    "crop_area_affected_ha",
    "landslide_area_ha",
    "roads_damaged",
    "houses_damaged",
    "lives_lost",
    "rainfall_mm",
    "river_danger_level_count",
    "historical_hazard_score",
]

CATEGORICAL_FEATURES = [
    "district",
]


# ============================================================
# DATA VALIDATION
# ============================================================

def validate_dataset(df: pd.DataFrame):
    """
    Validates that the dataset contains all required
    feature columns and the target column.
    """

    required_columns = FEATURES + [TARGET]

    missing_columns = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            "\nDataset is missing required columns:\n"
            + "\n".join(
                f" - {column}"
                for column in missing_columns
            )
        )

    if df.empty:
        raise ValueError(
            "The input dataset is empty."
        )

    if len(df) < 2:
        raise ValueError(
            "At least 2 rows are required to train a model."
        )


def clean_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """
    Cleans the training dataset and prepares it
    for machine learning.
    """

    df = df.copy()

    # --------------------------------------------------------
    # Clean target labels
    # --------------------------------------------------------

    df[TARGET] = (
        df[TARGET]
        .astype(str)
        .str.strip()
        .str.upper()
    )

    # Remove invalid labels.
    invalid_labels = [
        "",
        "NAN",
        "NONE",
        "NULL",
    ]

    df = df[
        ~df[TARGET].isin(invalid_labels)
    ].copy()

    if df.empty:
        raise ValueError(
            "No valid risk labels remain after cleaning."
        )

    # --------------------------------------------------------
    # Clean district
    # --------------------------------------------------------

    df["district"] = (
        df["district"]
        .astype(str)
        .str.strip()
    )

    # --------------------------------------------------------
    # Convert numeric features safely
    # --------------------------------------------------------

    for column in NUMERIC_FEATURES:

        df[column] = pd.to_numeric(
            df[column],
            errors="coerce",
        )

        # Negative values are invalid for these
        # disaster impact variables.
        df[column] = df[column].clip(
            lower=0
        )

    # --------------------------------------------------------
    # Remove completely empty feature rows
    # --------------------------------------------------------

    feature_rows_before = len(df)

    df = df.dropna(
        how="all",
        subset=NUMERIC_FEATURES,
    )

    if df.empty:
        raise ValueError(
            "All feature rows became empty after cleaning."
        )

    removed = (
        feature_rows_before
        - len(df)
    )

    if removed > 0:
        print(
            f"Removed {removed} completely empty feature rows."
        )

    return df


# ============================================================
# BUILD PREPROCESSOR
# ============================================================

def build_preprocessor():
    """
    Creates the preprocessing pipeline.
    """

    numeric_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="median"
                ),
            ),
        ]
    )

    categorical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="most_frequent"
                ),
            ),
            (
                "onehot",
                OneHotEncoder(
                    handle_unknown="ignore"
                ),
            ),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numeric",
                numeric_pipeline,
                NUMERIC_FEATURES,
            ),
            (
                "categorical",
                categorical_pipeline,
                CATEGORICAL_FEATURES,
            ),
        ],
        remainder="drop",
    )

    return preprocessor


# ============================================================
# BUILD MODEL
# ============================================================

def build_model():
    """
    Creates the Random Forest classifier.
    """

    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=10,
        min_samples_split=2,
        min_samples_leaf=1,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )

    return model


# ============================================================
# CHECK WHETHER STRATIFIED SPLIT IS POSSIBLE
# ============================================================

def can_stratify(y: pd.Series) -> bool:
    """
    Checks whether every class has enough samples
    for stratified train-test splitting.
    """

    class_counts = y.value_counts()

    if len(class_counts) < 2:
        return False

    if class_counts.min() < 2:
        return False

    return True


# ============================================================
# TRAIN AND EVALUATE
# ============================================================

def train_and_evaluate(
    pipeline,
    X,
    y,
):
    """
    Trains the model.

    Performs a stratified train-test evaluation when
    the dataset is large enough.

    Otherwise trains on the complete dataset.
    """

    results = {
        "evaluation_performed": False,
        "accuracy": None,
        "classification_report": None,
        "confusion_matrix": None,
    }

    dataset_size = len(X)
    number_of_classes = y.nunique()

    # --------------------------------------------------------
    # Determine if evaluation is possible.
    # --------------------------------------------------------

    evaluation_possible = (
        dataset_size >= 20
        and number_of_classes >= 2
        and can_stratify(y)
    )

    if evaluation_possible:

        # Ensure the test set can contain
        # at least one example from every class.
        minimum_test_fraction = (
            number_of_classes
            / dataset_size
        )

        test_size = max(
            0.25,
            minimum_test_fraction,
        )

        # Prevent an excessively large test set.
        test_size = min(
            test_size,
            0.40,
        )

        print(
            "\n"
            + "=" * 60
        )

        print(
            "TRAIN / TEST SPLIT"
        )

        print(
            "=" * 60
        )

        print(
            f"Total records: {dataset_size}"
        )

        print(
            f"Classes: {number_of_classes}"
        )

        print(
            f"Test size: {test_size:.2f}"
        )

        X_train, X_test, y_train, y_test = (
            train_test_split(
                X,
                y,
                test_size=test_size,
                random_state=42,
                stratify=y,
            )
        )

        print(
            f"Training records: {len(X_train)}"
        )

        print(
            f"Testing records: {len(X_test)}"
        )

        # ----------------------------------------------------
        # Train
        # ----------------------------------------------------

        pipeline.fit(
            X_train,
            y_train,
        )

        # ----------------------------------------------------
        # Predict
        # ----------------------------------------------------

        predictions = pipeline.predict(
            X_test
        )

        accuracy = accuracy_score(
            y_test,
            predictions,
        )

        report_dict = classification_report(
            y_test,
            predictions,
            zero_division=0,
            output_dict=True,
        )

        report_text = classification_report(
            y_test,
            predictions,
            zero_division=0,
        )

        matrix = confusion_matrix(
            y_test,
            predictions,
            labels=pipeline.named_steps[
                "model"
            ].classes_,
        )

        print(
            "\n"
            + "=" * 60
        )

        print(
            "MODEL EVALUATION"
        )

        print(
            "=" * 60
        )

        print(
            f"Accuracy: {accuracy:.4f}"
        )

        print(
            "\nClassification Report:"
        )

        print(
            report_text
        )

        print(
            "Confusion Matrix:"
        )

        print(
            matrix
        )

        results = {
            "evaluation_performed": True,
            "accuracy": float(
                accuracy
            ),
            "classification_report": report_dict,
            "confusion_matrix": matrix.tolist(),
        }

        # ----------------------------------------------------
        # Refit on full dataset.
        #
        # After evaluation, the final saved model uses
        # every available training record.
        # ----------------------------------------------------

        print(
            "\nRetraining final model on the complete dataset..."
        )

        pipeline.fit(
            X,
            y,
        )

    else:

        print(
            "\n"
            + "=" * 60
        )

        print(
            "LIMITED DATASET"
        )

        print(
            "=" * 60
        )

        print(
            "The dataset is too small or does not have enough "
            "samples per class for a reliable stratified evaluation."
        )

        print(
            "Training the model using all available records."
        )

        pipeline.fit(
            X,
            y,
        )

    return pipeline, results


# ============================================================
# MAIN
# ============================================================

def main():

    parser = argparse.ArgumentParser(
        description=(
            "Train a Random Forest disaster risk "
            "classification model."
        )
    )

    parser.add_argument(
        "--input",
        required=True,
        help=(
            "Path to the training dataset CSV file."
        ),
    )

    parser.add_argument(
        "--model-out",
        required=True,
        help=(
            "Path where the trained model will be saved."
        ),
    )

    args = parser.parse_args()

    input_path = Path(
        args.input
    )

    model_path = Path(
        args.model_out
    )

    # ========================================================
    # CHECK INPUT FILE
    # ========================================================

    if not input_path.exists():

        raise FileNotFoundError(
            f"Training dataset not found: {input_path}"
        )

    if not input_path.is_file():

        raise ValueError(
            f"Input path is not a file: {input_path}"
        )

    # ========================================================
    # LOAD DATA
    # ========================================================

    print(
        "\n"
        + "=" * 60
    )

    print(
        "LOADING TRAINING DATASET"
    )

    print(
        "=" * 60
    )

    print(
        f"Input file: {input_path}"
    )

    df = pd.read_csv(
        input_path
    )

    print(
        f"Records loaded: {len(df)}"
    )

    print(
        f"Columns found: {len(df.columns)}"
    )

    # ========================================================
    # VALIDATE
    # ========================================================

    validate_dataset(
        df
    )

    # ========================================================
    # CLEAN
    # ========================================================

    df = clean_dataset(
        df
    )

    print(
        f"Records after cleaning: {len(df)}"
    )

    # ========================================================
    # SHOW CLASS DISTRIBUTION
    # ========================================================

    print(
        "\nRisk label distribution:"
    )

    print(
        df[TARGET]
        .value_counts()
        .sort_index()
        .to_string()
    )

    # ========================================================
    # PREPARE X AND Y
    # ========================================================

    X = df[
        FEATURES
    ].copy()

    y = df[
        TARGET
    ].copy()

    if y.nunique() < 2:

        raise ValueError(
            "At least two unique risk classes are required "
            "to train a classifier."
        )

    # ========================================================
    # BUILD PIPELINE
    # ========================================================

    preprocessor = build_preprocessor()

    model = build_model()

    pipeline = Pipeline(
        steps=[
            (
                "preprocessor",
                preprocessor,
            ),
            (
                "model",
                model,
            ),
        ]
    )

    # ========================================================
    # TRAIN
    # ========================================================

    pipeline, evaluation_results = (
        train_and_evaluate(
            pipeline,
            X,
            y,
        )
    )

    # ========================================================
    # CREATE OUTPUT DIRECTORY
    # ========================================================

    model_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    # ========================================================
    # CREATE MODEL PACKAGE
    # ========================================================

    model_package = {

        # Main ML pipeline
        "pipeline": pipeline,

        # Input features
        "features": FEATURES,

        # Feature types
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,

        # Target
        "target": TARGET,

        # Classes
        "classes": list(
            pipeline.named_steps[
                "model"
            ].classes_
        ),

        # Dataset information
        "training_records": int(
            len(df)
        ),

        "training_class_distribution": (
            df[TARGET]
            .value_counts()
            .to_dict()
        ),

        # Evaluation
        "evaluation": evaluation_results,

        # Training metadata
        "model_type": (
            "RandomForestClassifier"
        ),

        "trained_at": (
            datetime.now()
            .isoformat()
        ),
    }

    # ========================================================
    # SAVE MODEL
    # ========================================================

    joblib.dump(
        model_package,
        model_path,
    )

    # ========================================================
    # SUCCESS OUTPUT
    # ========================================================

    print(
        "\n"
        + "=" * 60
    )

    print(
        "MODEL TRAINING COMPLETED SUCCESSFULLY"
    )

    print(
        "=" * 60
    )

    print(
        f"Model type: {model_package['model_type']}"
    )

    print(
        f"Training records: "
        f"{model_package['training_records']}"
    )

    print(
        f"Risk classes: "
        f"{', '.join(model_package['classes'])}"
    )

    print(
        f"Model saved to:"
    )

    print(
        model_path.resolve()
    )

    print(
        "\n"
        + "=" * 60
    )


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    main()