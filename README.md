# Template Module

## Description
This project is a starting point to add custom business logic via scripts in the Creatio mobile app.

## Prerequisites
- Node.js
- npm

## Installation
To install the project dependencies, run:
```bash
npm install
```

## Scripts
Includes several npm scripts to help with development and deployment:
 - build: Bundles the project using webpack.
```bash
npm run build
```
- prepare-debug: Prepares the project for debugging if you have access to mobile app sources
```bash
npm run update-source-code
```
- inject-on-device: Injects the built project onto a device (can be used without accessing to mobile app sources)
```bash
npm run inject-on-device
```
Also package.json contains other helper scripts `build:...`.

All changes will be applied after app restart. Debugging is able by opening *chrome://inspect* in Chrome Desktop.

After writing custom code you can get release script from `out/mobile/DevModule/main.js` and push to your Creatio package.


