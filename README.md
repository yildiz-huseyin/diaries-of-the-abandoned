# Diaries of the Abandoned

An interactive web experience that tells the stories of five abandoned spacecraft on the Moon and Mars, told in their own first-person diary voices.

**Spacecraft featured**
- Apollo 11 Lunar Module (Moon)
- Viking 1 Lander (Mars)
- Opportunity Rover (Mars)
- InSight Lander (Mars)
- Ingenuity Mars Helicopter (Mars)

## Features
- First-person diary entries for each spacecraft, with optional audio narration
- NASA archive photographs
- Rotatable 3D models of each spacecraft
- Interactive landing-site maps using NASA Solar System Trek tiles
- "Kid Explorer" science panels
- Animated Moon/Mars background and generated ambient music

## Built With
- HTML, CSS, and JavaScript
- [Three.js](https://threejs.org/) for the background planet
- [model-viewer](https://modelviewer.dev/) for 3D models
- [Leaflet](https://leafletjs.com/) for maps
- Web Audio API for music
- Google Fonts (Fredoka, Nunito)

## Running Locally

Clone the repository and serve the folder with a local web server. Opening `index.html` directly from the file system will prevent the 3D models from loading.

```bash
git clone https://github.com/yildiz-huseyin/diaries-of-the-abandoned.git
cd diaries-of-the-abandoned
python -m http.server 8000
```

Then open http://localhost:8000 in your browser.

## Project Structure
