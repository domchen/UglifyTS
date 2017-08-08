var CommandLine;
(function (CommandLine) {
    CommandLine.optionDeclarations = [
        {
            name: "help",
            shortName: "h",
            type: "boolean",
            description: "Print help message."
        },
        {
            name: "project",
            shortName: "p",
            type: "string",
            description: "Obfuscate the source files in the given directory."
        },
        {
            name: "version",
            shortName: "v",
            type: "boolean",
            description: "Print UglifyTS’s version."
        }
    ];
    var optionNameMapCache;
    function getOptionNameMap() {
        if (optionNameMapCache) {
            return optionNameMapCache;
        }
        var optionNameMap = {};
        var shortOptionNames = {};
        CommandLine.optionDeclarations.forEach(function (option) {
            optionNameMap[option.name.toLowerCase()] = option;
            if (option.shortName) {
                shortOptionNames[option.shortName] = option.name;
            }
        });
        optionNameMapCache = { optionNameMap: optionNameMap, shortOptionNames: shortOptionNames };
        return optionNameMapCache;
    }
    function parse(args) {
        var options = {};
        options.errors = [];
        var _a = getOptionNameMap(), optionNameMap = _a.optionNameMap, shortOptionNames = _a.shortOptionNames;
        var i = 0;
        while (i < args.length) {
            var s = args[i];
            i++;
            if (s.charAt(0) == "-") {
                s = s.slice(s.charAt(1) == "-" ? 2 : 1).toLowerCase();
                if (s in shortOptionNames) {
                    s = shortOptionNames[s];
                }
                if (s in optionNameMap) {
                    var opt = optionNameMap[s];
                    if (!args[i] && opt.type !== "boolean") {
                        options.errors.push("Option '" + opt.name + "' expects an argument.");
                    }
                    switch (opt.type) {
                        case "number":
                            options[opt.name] = parseInt(args[i]);
                            i++;
                            break;
                        case "boolean":
                            options[opt.name] = true;
                            break;
                        case "string":
                            options[opt.name] = args[i] || "";
                            i++;
                            break;
                    }
                }
                else {
                    options.errors.push("Unknown option '" + s + "'.");
                }
            }
            else {
                options.outDir = s;
            }
        }
        if (!options.outDir) {
            options.outDir = "generated";
        }
        return options;
    }
    CommandLine.parse = parse;
})(CommandLine || (CommandLine = {}));
function createMap() {
    var map = Object.create(null);
    map["__"] = undefined;
    delete map["__"];
    return map;
}
var Program;
(function (Program) {
    var fs = require("fs");
    var path = require("path");
    var ts = require("typescript");
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
        Obfuscate.generate(config.fileNames, config.compilerOptions, outDir);
    }
    Program.run = run;
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
})(Program || (Program = {}));
Program.run(process.argv.slice(2));
