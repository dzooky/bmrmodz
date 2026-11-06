# BMRMODZ — BMW MGU Apps

Independent repository for BMRMODZ's custom BMW MGU / iDrive 7 applications.

## Applications

- **Oil Service Assistant (OSA)** — engine and transmission oil temperature monitoring. The transmission reader uses read-only UDS requests.
- **DPF tools** — planned.

## Build

The repository follows the MGU Store repository format in `mgu-repo.json`.

To build OSA locally:

```sh
python3 kit/tools/build.py osa
```

The BMW `oap-sdk` is not redistributed. As in the source MGU kit, extract it from an app on your own head unit with:

```sh
node kit/tools/extract_sdk.js /path/to/app.js
```

Keep the generated `oap-sdk/` directory local; it is intentionally not committed.

## Credits and licensing

The shared MGU runtime, build tooling and renderer are carried over from the MIT-licensed MGU Custom Apps project. See [LICENSE](LICENSE) and the renderer licenses in `kit/renderd/prebuilt/`.

Only the files required for BMRMODZ applications are included; unrelated apps from the source repository are not copied.
