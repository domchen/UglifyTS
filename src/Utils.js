"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var Path = require("path");
var ts = require("typescript");
var defaultFormatDiagnosticsHost = {
    getCurrentDirectory: function () { return ts.sys.getCurrentDirectory(); },
    getNewLine: function () { return ts.sys.newLine; },
    getCanonicalFileName: createGetCanonicalFileName(ts.sys.useCaseSensitiveFileNames)
};
function createGetCanonicalFileName(useCaseSensitivefileNames) {
    return useCaseSensitivefileNames
        ? (function (fileName) { return fileName; })
        : (function (fileName) { return fileName.toLowerCase(); });
}
function formatDiagnostics(diagnostics) {
    return ts.formatDiagnostics(diagnostics, defaultFormatDiagnosticsHost);
}
exports.formatDiagnostics = formatDiagnostics;
function getRootLength(path) {
    if (path.charAt(0) == "/") {
        if (path.charAt(1) != "/")
            return 1;
        var p1 = path.indexOf("/", 2);
        if (p1 < 0)
            return 2;
        var p2 = path.indexOf("/", p1 + 1);
        if (p2 < 0)
            return p1 + 1;
        return p2 + 1;
    }
    if (path.charAt(1) == ":") {
        if (path.charAt(2) == "/")
            return 3;
        return 2;
    }
    if (path.lastIndexOf("file:///", 0) === 0) {
        return "file:///".length;
    }
    var idx = path.indexOf("://");
    if (idx !== -1) {
        return idx + "://".length;
    }
    return 0;
}
var directorySeparator = "/";
function joinPath(path1, path2) {
    if (!(path1 && path1.length))
        return path2;
    if (!(path2 && path2.length))
        return path1;
    path1 = path1.split("\\").join(directorySeparator);
    path2 = path2.split("\\").join(directorySeparator);
    if (getRootLength(path2) !== 0)
        return path2;
    if (path1.charAt(path1.length - 1) === directorySeparator)
        return path1 + path2;
    return path1 + directorySeparator + path2;
}
exports.joinPath = joinPath;
function createDirectory(filePath, mode) {
    if (mode === undefined) {
        mode = 511 & (~process.umask());
    }
    filePath = Path.resolve(filePath);
    try {
        fs.mkdirSync(filePath, mode);
    }
    catch (err0) {
        switch (err0.code) {
            case 'ENOENT':
                createDirectory(Path.dirname(filePath), mode);
                createDirectory(filePath, mode);
                break;
            default:
                var stat = void 0;
                try {
                    stat = fs.statSync(filePath);
                }
                catch (err1) {
                    throw err0;
                }
                if (!stat.isDirectory()) {
                    throw err0;
                }
                break;
        }
    }
}
exports.createDirectory = createDirectory;
function deleteDirectory(path) {
    var files = [];
    if (fs.existsSync(path)) {
        files = fs.readdirSync(path);
        files.forEach(function (file) {
            var curPath = path + "/" + file;
            if (fs.statSync(curPath).isDirectory()) {
                deleteDirectory(curPath);
            }
            else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}
function deletePath(path) {
    try {
        if (fs.lstatSync(path).isDirectory()) {
            deleteDirectory(path);
        }
        else {
            fs.unlinkSync(path);
        }
    }
    catch (e) {
    }
}
exports.deletePath = deletePath;
function writeFileTo(filePath, content, overwrite, mode) {
    if (fs.existsSync(filePath)) {
        if (!overwrite) {
            return false;
        }
        var stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            return false;
        }
    }
    var folder = Path.dirname(filePath);
    if (!fs.existsSync(folder)) {
        createDirectory(folder);
    }
    var fd;
    try {
        fd = fs.openSync(filePath, 'w', 438);
    }
    catch (e) {
        fs.chmodSync(filePath, 438);
        fd = fs.openSync(filePath, 'w', 438);
    }
    if (fd) {
        if (typeof content == "string") {
            fs.writeSync(fd, content, 0, 'utf8');
        }
        else {
            fs.writeSync(fd, content, 0, content.length, 0);
        }
        fs.closeSync(fd);
    }
    fs.chmodSync(filePath, mode || 438);
    return true;
}
exports.writeFileTo = writeFileTo;
