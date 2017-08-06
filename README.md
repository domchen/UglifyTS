<p align="left">
  <a href="https://www.npmjs.com/package/uglifyts"><img src="https://img.shields.io/npm/v/uglifyts.svg" alt="Version"></a>
  <a href="https://github.com/domchen/uglifyts/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/uglifyts.svg" alt="License"></a>
  <a href="https://github.com/Microsoft/Typescript"><img src="https://img.shields.io/badge/code-TypeScript-blue.svg" alt="TypeScript"></a>
</p>

## Introduction

UglifyTS is a source code obfuscation tool for TypeScript. It accepts TypeScript source files, and generates the functionally equivalent source files which are much harder to understand or reverse-engineer. This tool is usually used for source code protection.


## Installation

First make sure you have installed the latest version of [node.js](http://nodejs.org/)
(You may need to restart your computer after this step).

For use as a command line app:

```
npm install -g uglifyts
```

For programmatic use:

```
npm install uglifyts
```

## Usage

```
uglifyts [input files] [options]
```