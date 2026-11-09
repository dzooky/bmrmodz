from PIL import Image

source = "apps/osa/brmodz_logo.png"
target = "brmodz_logo_github.png"

image = Image.open(source).convert("RGBA")
pixels = image.load()

# Recolor only neutral near-white pixels; retain each pixel's original alpha.
for y in range(image.height):
    for x in range(image.width):
        r, g, b, a = pixels[x, y]
        if a and min(r, g, b) >= 180 and max(r, g, b) - min(r, g, b) <= 12:
            pixels[x, y] = (36, 41, 47, a)

image.save(target, format="PNG", optimize=True)
