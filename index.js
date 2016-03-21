var Plugin = require('broccoli-plugin');
var path = require('path');
var fs = require('fs');
var RSVP = require('rsvp');
var required = require('required');
var symlinkOrCopySync = require('symlink-or-copy').sync;

// Create a subclass NodeImporter derived from Plugin
NodeImporter.prototype = Object.create(Plugin.prototype);
NodeImporter.prototype.constructor = NodeImporter;

function NodeImporter(inputNodes, options) {
	options = options || {};
	Plugin.call(this, inputNodes, {
		annotation: options.annotation
	});
	this.options = options;
	this.options.ignore = this.options.ignore || [];
	this.options.mainFile = this.options.mainFile || 'index.js';
}

NodeImporter.prototype.build = function() {
	this.npmPaths = [];
	var indexPath = path.join(this.inputPaths[0], this.options.mainFile);

	var output = "";
	var nodeModulesOutPath = path.join(this.outputPath, 'node_modules');
	fs.mkdirSync(nodeModulesOutPath);

	var self = this;

	return new RSVP.Promise(function(resolve, reject) {
		required(indexPath, function(err, deps) {
			if (err) {
				reject(err);
			}
			else {
				self.linkDeps(deps, nodeModulesOutPath);
				resolve(null);
			}
		});
	});
};

NodeImporter.prototype.linkDeps = function(deps, nodeModulesOutPath) {
	const moduleFolderRegex = /(.*\\node_modules\\)([^\\]*)\\.*/;
	if (deps) {
		var len = deps.length;
		for (var i = 0; i < len; i++) {
			var dependency = deps[i];
			if (!dependency.core && 
					!this.options.ignore.contains(dependency.id))
			{
				var parts = moduleFolderRegex.exec(dependency.filename);
				if (parts)
				{
					var folder = parts[2];
					if (this.npmPaths.indexOf(folder) === -1)
					{
						// haven't seen this folder before
						this.npmPaths.push(folder);
						var modulePath = path.join(parts[1], folder);
						this.linkNpmModule(modulePath, nodeModulesOutPath);
					}
					// recurse
					this.linkDeps(dependency.deps, nodeModulesOutPath);
				}
			}
		}
	}
}

NodeImporter.prototype.linkNpmModule = function(folder, nodeModulesOutPath) {
	var module = path.basename(folder);
	moduleOutPath = path.join(nodeModulesOutPath, module);
	try
	{
		fs.statSync(moduleOutPath); // throws if path doesn't exist
	}
	catch(err)
	{
		// fill the hole
		symlinkOrCopySync(folder, moduleOutPath);
	}
}

module.exports = NodeImporter;