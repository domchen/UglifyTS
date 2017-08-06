[![npm version](https://badge.fury.io/js/uglifyts.svg)](https://badge.fury.io/js/uglifyts)

# Introduction

UglifyTS is a source code obfuscation tool for TypeScript. It accepts TypeScript source files, and generates the functionally equivalent source files which are much harder to understand or reverse-engineer. This tool is usually used for source code protection.


## Installing

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