import argparse
from pathlib import Path
import json

import joblib
import pandas as pd


DEFAULT_VALUES = {
    "district": "Unknown",
    "affected_villages": 0,
    "population_affected": 0,
    "crop_area_affected_ha": 0,
    "landslide_area_ha": 0,
    "roads_damaged": 0,
    "houses_damaged": 0,
    "lives_lost": 0,
    "rainfall_mm": 0,
    "river_danger_level_count": 0,
    "historical_hazard_score": 0,
}


def load_model(model_path):
    """
    Load the trained model artifact.
    """
    model_path = Path(model_path)

    if not model_path.exists():
        raise FileNotFoundError(
            f"Model file not found: {model_path.resolve()}"
        )

    artifact = joblib.load(model_path)

    if "pipeline" not in artifact:
        raise ValueError(
            "Invalid model file. 'pipeline' was not found in the model artifact."
        )

    if "features" not in artifact:
        raise ValueError(
            "Invalid model file. 'features' was not found in the model artifact."
        )

    return artifact


def prepare_input(features, payload):
    """
    Prepare the input payload in the exact feature order
    required by the trained model.
    """

    row = {}

    for feature in features:

        # Use the provided value if available.
        if feature in payload:
            value = payload[feature]
        else:
            # Otherwise use a safe default.
            value = DEFAULT_VALUES.get(feature, 0)

        row[feature] = value

    return pd.DataFrame([row])


def predict_risk(model_path, payload):
    """
    Predict disaster risk using the trained model.

    Parameters
    ----------
    model_path : str or Path
        Path to the trained .joblib model.

    payload : dict
        Dictionary containing input features.

    Returns
    -------
    dict
        Prediction result containing:
        - risk_level
        - confidence
        - probabilities
    """

    artifact = load_model(model_path)

    features = artifact["features"]
    pipeline = artifact["pipeline"]

    # Prepare input data.
    df = prepare_input(features, payload)

    # Predict risk class.
    prediction = pipeline.predict(df)[0]

    # Get probability for every class.
    probabilities = pipeline.predict_proba(df)[0]

    # Get class labels.
    classes = pipeline.named_steps["model"].classes_

    # Create readable probability dictionary.
    probability_dict = {
        str(label): round(float(probability), 6)
        for label, probability in zip(classes, probabilities)
    }

    # Confidence of predicted class.
    confidence = probability_dict.get(
        str(prediction),
        float(max(probabilities))
    )

    return {
        "risk_level": str(prediction),
        "confidence": round(float(confidence), 6),
        "confidence_percentage": round(float(confidence) * 100, 2),
        "probabilities": probability_dict,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Predict disaster risk using the trained ML model."
    )

    parser.add_argument(
        "--model",
        default="models/risk_model.joblib",
        help="Path to the trained model."
    )

    parser.add_argument(
        "--district",
        default="Cachar",
        help="District name."
    )

    parser.add_argument(
        "--affected-villages",
        type=float,
        default=0,
        help="Number of affected villages."
    )

    parser.add_argument(
        "--population-affected",
        type=float,
        default=0,
        help="Population affected."
    )

    parser.add_argument(
        "--crop-area-affected-ha",
        type=float,
        default=0,
        help="Crop area affected in hectares."
    )

    parser.add_argument(
        "--landslide-area-ha",
        type=float,
        default=0,
        help="Landslide area affected in hectares."
    )

    parser.add_argument(
        "--roads-damaged",
        type=float,
        default=0,
        help="Number of roads damaged."
    )

    parser.add_argument(
        "--houses-damaged",
        type=float,
        default=0,
        help="Number of houses damaged."
    )

    parser.add_argument(
        "--lives-lost",
        type=float,
        default=0,
        help="Number of lives lost."
    )

    parser.add_argument(
        "--rainfall-mm",
        type=float,
        default=0,
        help="Rainfall in millimeters."
    )

    parser.add_argument(
        "--river-danger-level-count",
        type=float,
        default=0,
        help="Number of rivers above danger level."
    )

    parser.add_argument(
        "--historical-hazard-score",
        type=float,
        default=0,
        help="Historical hazard score."
    )

    args = parser.parse_args()

    payload = {
        "district": args.district,
        "affected_villages": args.affected_villages,
        "population_affected": args.population_affected,
        "crop_area_affected_ha": args.crop_area_affected_ha,
        "landslide_area_ha": args.landslide_area_ha,
        "roads_damaged": args.roads_damaged,
        "houses_damaged": args.houses_damaged,
        "lives_lost": args.lives_lost,
        "rainfall_mm": args.rainfall_mm,
        "river_danger_level_count": args.river_danger_level_count,
        "historical_hazard_score": args.historical_hazard_score,
    }

    try:
        result = predict_risk(
            model_path=args.model,
            payload=payload
        )

        print("\n" + "=" * 55)
        print("DISASTER RISK PREDICTION")
        print("=" * 55)

        print(f"District: {payload['district']}")
        print(f"Predicted Risk Level: {result['risk_level']}")
        print(
            f"Confidence: "
            f"{result['confidence_percentage']}%"
        )

        print("\nClass Probabilities:")

        for risk_level, probability in result["probabilities"].items():
            print(
                f"  {risk_level}: "
                f"{probability * 100:.2f}%"
            )

        print("\nJSON Result:")
        print(json.dumps(result, indent=4))

        print("=" * 55)

    except Exception as error:
        print("\nERROR:")
        print(error)
        raise


if __name__ == "__main__":
    main()