"""Generate the two About QR assets for a configured mobile feedback form."""
import argparse
import json
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import qrcode


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="Public HTTPS URL of the feedback form")
    parser.add_argument("--app", default="osa", help="App directory name (default: osa)")
    args = parser.parse_args()
    base = urlsplit(args.url)
    if base.scheme != "https" or not base.hostname or base.username or base.password:
        parser.error("Provide a public HTTPS URL without credentials.")
    apps = Path(__file__).resolve().parents[2] / "apps"
    app = (apps / args.app).resolve()
    if app.parent != apps or not (app / "app.json").is_file():
        parser.error("Select an existing app.")
    manifest = json.loads((app / "app.json").read_text(encoding="utf-8"))
    query = dict(parse_qsl(base.query, keep_blank_values=True))
    query.update(app=manifest["id"], version=manifest["version"])
    images = []
    for kind, name in [("bug", "qr_report_bug.png"), ("feature", "qr_request_feature.png")]:
        url = urlunsplit(base._replace(query=urlencode(dict(query, type=kind))))
        qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=2, border=0)
        qr.add_data(url)
        qr.make(fit=True)
        if qr.modules_count > 50:
            parser.error("The form URL is too long. Use a shorter public URL.")
        # The app scales the unpadded QR image to its display slot.
        images.append((qr.make_image().convert("RGB"), app / name))
    for image, target in images:
        image.save(target)
        print(target)


if __name__ == "__main__":
    main()
