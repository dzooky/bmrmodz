# BMRMODZ — BMW MGU Apps

Independent repository for BMRMODZ's custom BMW MGU / iDrive 7 applications.

## Applications

- **Oil Service Assistant (OSA)** — engine and transmission oil temperature monitoring. The transmission reader uses read-only UDS requests.
- **DPF tools** — DPF is in build phase.

## Build

The repository follows the MGU Store repository format in `mgu-repo.json`.

The repository is configured for **mgu-store** to build OSA on the head unit.
The Store supplies the BMW SDK donor and links the SDK into the app during its
source build. The build script therefore omits `node_modules/oap-sdk` from the
published package; BMW's SDK is not redistributed.

For a standalone local build (outside mgu-store), the SDK must first be extracted
from an app on your own head unit with:

```sh
node kit/tools/extract_sdk.js /path/to/app.js
python3 kit/tools/build.py osa
```

Keep the generated `oap-sdk/` directory local; it is intentionally not committed.

## Credits and licensing

The shared MGU runtime, build tooling and renderer are carried over from the MIT-licensed MGU Custom Apps project. See [LICENSE](LICENSE) and the renderer licenses in `kit/renderd/prebuilt/`.

Only the files required for BMRMODZ applications are included; unrelated apps from the source repository are not copied.
