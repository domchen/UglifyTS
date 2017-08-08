"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var path = require("path");
var ts = require("typescript");
var Utils = require("./Utils");
var Obfuscate = require("./Obfuscate");
var CommandLine = require("./CommandLine");
var VERSION = "0.0.1";
function run(args) {
    var commandOptions = CommandLine.parse(args);
    if (commandOptions.errors.length > 0) {
        console.log(commandOptions.errors.join("\n") + "\n");
        process.exit(1);
    }
    if (commandOptions.version) {
        printVersion();
        return;
    }
    if (commandOptions.help) {
        printVersion();
        printHelp();
        return;
    }
    var configFileName = "";
    if (commandOptions.project) {
        if (!commandOptions.project || ts.sys.directoryExists(commandOptions.project)) {
            configFileName = Utils.joinPath(commandOptions.project, "tsconfig.json");
        }
        else {
            configFileName = commandOptions.project;
        }
        if (ts.sys.fileExists(configFileName)) {
            ts.sys.write("Cannot find a tsconfig.json file at the specified directory: " + commandOptions.project + ts.sys.newLine);
            ts.sys.exit(1);
        }
    }
    else {
        var currentDir = ts.sys.getCurrentDirectory();
        configFileName = findConfigFile(currentDir);
        if (!configFileName) {
            printVersion();
            printHelp();
            ts.sys.exit(0);
        }
    }
    var outDir = path.resolve(commandOptions.outDir);
    var config = parseOptionsFromFile(configFileName);
    if (config.errors.length > 0) {
        console.log(config.errors.join("\n") + "\n");
        process.exit(1);
    }
    Obfuscate.generate(config.fileNames, config.compilerOptions, path.dirname(configFileName), outDir);
}
exports.run = run;
function findConfigFile(searchPath) {
    while (true) {
        var fileName = Utils.joinPath(searchPath, "tsconfig.json");
        if (ts.sys.fileExists(fileName)) {
            return fileName;
        }
        var parentPath = path.dirname(searchPath);
        if (parentPath === searchPath) {
            break;
        }
        searchPath = parentPath;
    }
    return "";
}
function parseOptionsFromFile(configFileName) {
    var jsonResult = ts.parseConfigFileTextToJson(configFileName, ts.sys.readFile(configFileName));
    var configObject = jsonResult.config;
    if (!configObject) {
        var result = {};
        result.errors = [Utils.formatDiagnostics([jsonResult.error])];
        return result;
    }
    var baseDir = path.dirname(configFileName);
    return parseOptionsFromJson(configObject, baseDir, configFileName);
}
function parseOptionsFromJson(jsonOptions, basePath, configFileName) {
    var result = {};
    result.errors = [];
    result.fileNames = [];
    var compilerResult = ts.convertCompilerOptionsFromJson(jsonOptions["compilerOptions"], basePath, configFileName);
    if (compilerResult.errors.length > 0) {
        result.errors.push(Utils.formatDiagnostics(compilerResult.errors));
        return result;
    }
    var compilerOptions = compilerResult.options;
    result.compilerOptions = compilerOptions;
    var outDir = basePath;
    if (compilerOptions.outDir) {
        outDir = compilerOptions.outDir;
    }
    var optionResult = ts.parseJsonConfigFileContent(jsonOptions, ts.sys, basePath);
    if (optionResult.errors.length > 0) {
        result.errors.push(Utils.formatDiagnostics(optionResult.errors));
    }
    else {
        result.fileNames = optionResult.fileNames;
    }
    return result;
}
function printVersion() {
    console.log("Version " + VERSION + "\n");
}
function printHelp() {
    var newLine = "\n";
    var output = "";
    output += "Syntax:   uglifyts [outDir] [options]" + newLine + newLine;
    output += "Examples: uglifyts --version" + newLine;
    output += "Examples: uglifyts ../generated/" + newLine + newLine;
    output += "Options:" + newLine;
    CommandLine.optionDeclarations.forEach(function (option) {
        var name = "";
        if (option.shortName) {
            name += "-" + option.shortName + ", ";
        }
        name += "--" + option.name;
        name += makePadding(25 - name.length);
        output += name + option.description + newLine;
    });
    console.log(output);
}
function makePadding(paddingLength) {
    return Array(paddingLength + 1).join(" ");
}
run(process.argv.slice(2));
