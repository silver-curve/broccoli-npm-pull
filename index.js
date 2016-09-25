var Plugin = require('broccoli-plugin');
var path = require('path');
var fs = require('fs');
var RSVP = require('rsvp');
var requireTraverser = require('require-traverser');
var Module = require('module').Module;
var symlinkOrCopySync = require('symlink-or-copy').sync;
var detective = require('detective');

function getFolderFromPath (fullPath) {
	return fs.statSync(fullPath).isDirectory() ? fullPath : path.dirname(fullPath);
}

// Create a subclass NodeImporter derived from Plugin
NodeImporter.prototype = Object.create(Plugin.prototype);
NodeImporter.prototype.constructor = NodeImporter;

function NodeImporter (inputNodes, options) {
	options = options || {};
	Plugin.call(this, inputNodes, {
		annotation: options.annotation
	});
	this.options = options;
	this.options.ignore = this.options.ignore || [];
	this.options.mainFile = this.options.mainFile || 'index.js';
}

NodeImporter.prototype.build = function () {
	this.linkedModules = {};
	var indexPath = path.join(this.inputPaths[0], this.options.mainFile);

	var modulePath = this.inputPaths[0];
	var moduleFile = indexPath;
	fs.mkdirSync(path.join(this.outputPath, 'node_modules'));

	var self = this;

	return new RSVP.Promise(function(resolve, reject) {
		var npmPaths = {};
		requireTraverser(modulePath, moduleFile, function(err, files) {
			if (err) {
				reject(err);
			}
			for (file in files)
			{
				var filename = path.basename(file);
				// if file is a folder, use that else, use the folder it is in

				var folder = getFolderFromPath(file);
				if (!npmPaths[folder])
				{
					// haven't seen this folder before
					npmPaths[folder] = true;
				}
			}

			resolve(Object.keys(npmPaths));
		})
	})
	.then(npmPaths => {
		for (var npmPath of npmPaths) {
			this.linkNpmModule(npmPath);
		}
	});
};

NodeImporter.prototype.linkNpmModule = function (folder) {
	// Strip the leading path off up to the first occurrence of node_modules,
	// and remove everything after the root module name.
	var nodeModulesIndex = folder.indexOf("node_modules");
	if (nodeModulesIndex === -1)
	{
		// this is not a node module
		return;
	}
	var basePath = folder.substr(0, nodeModulesIndex);
	var folderRelativePath = folder.substr(nodeModulesIndex);
	var modulePathParts = folderRelativePath.split(path.sep);
	var moduleRelativePath = path.join("node_modules", modulePathParts[1]);
	var moduleOutPath = path.join(this.outputPath, moduleRelativePath);

	// Don't bother if we've already linked this module or we're ignoring it.
	if (this.linkedModules[moduleOutPath] || this.options.ignore.contains(modulePathParts[1]))
	{
		return;
	}

	symlinkOrCopySync(path.join(basePath, moduleRelativePath), moduleOutPath);
	this.linkedModules[moduleOutPath] = true;
};

module.exports = NodeImporter;
