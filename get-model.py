"""
Download a Vosk speech model into ./model.

Usage:
  python get-model.py            # default: en-us-0.22-lgraph (better with accents)
  python get-model.py lgraph     # en-us-0.22-lgraph (~128 MB, default) — supports grammar
  python get-model.py small      # en-us-0.15      (~40 MB, lightest, lower accuracy)
  python get-model.py indian     # small-en-in-0.4 (~36 MB, Indian English)

All of these support the grammar-constrained recognition server.py uses.
To switch models later: `rm -rf model` then run this again with the model you want.
"""
import os, sys, urllib.request, zipfile

MODELS = {
    "lgraph": "vosk-model-en-us-0.22-lgraph",   # bigger acoustic model, handles accents better
    "small":  "vosk-model-small-en-us-0.15",    # tiny, lightest on RAM/CPU
    "indian": "vosk-model-small-en-in-0.4",     # Indian English
}
BASE_URL = "https://alphacephei.com/vosk/models/"

def main():
    key = sys.argv[1] if len(sys.argv) > 1 else "lgraph"
    name = MODELS.get(key)
    if not name:
        print("Unknown model '%s'. Choose one of: %s" % (key, ", ".join(MODELS)))
        sys.exit(1)
    if os.path.isdir("model"):
        print("model/ already exists. To switch models: rm -rf model && python get-model.py %s" % key)
        return
    url = BASE_URL + name + ".zip"
    print("Downloading %s ..." % url)
    urllib.request.urlretrieve(url, "model.zip")
    print("Extracting...")
    with zipfile.ZipFile("model.zip") as z:
        z.extractall(".")
    os.rename(name, "model")
    os.remove("model.zip")
    print("Done -> ./model  (%s)" % name)

if __name__ == "__main__":
    main()
