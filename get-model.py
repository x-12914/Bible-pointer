"""
Download the small English Vosk model into ./model.
Run once on a new machine / server:  python get-model.py
"""
import os, sys, urllib.request, zipfile

URL = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"
EXTRACTED = "vosk-model-small-en-us-0.15"

def main():
    if os.path.isdir("model"):
        print("model/ already exists — delete it first if you want to re-download.")
        return
    print("Downloading model (~40 MB):", URL)
    urllib.request.urlretrieve(URL, "model.zip")
    print("Extracting...")
    with zipfile.ZipFile("model.zip") as z:
        z.extractall(".")
    os.rename(EXTRACTED, "model")
    os.remove("model.zip")
    print("Done -> ./model")

if __name__ == "__main__":
    main()
