var http = require("http"),
	program = require("commander"),
	soap = require("soap"),
	RSVP = require("rsvp"),
	promise = require("rsvp").Promise,
	Logger = require("logger"),
	request = require("request"),
	Etcd = require("node-etcd"),
	swig = require('swig');

var pkg = require('./package.json');
var logger = new Logger("WSDL service");
var config = {};
var HHRPros = {};   // etcd HHRPro registred instances
var loop = setInterval(getHHRServices, 5000);

program
	.version(pkg.version)
	.usage('[options] [dir]')
	.option('-h, --host [value]', 'etcd server [172.17.42.1]', '172.17.42.1')
	.option('-c, --config <config>', 'configuration file', String)
	.parse(process.argv);

if (program.config) {
	if (!program.config.match(/^\//)) {
		program.config = path.join(__dirname + '/..', program.config);
	}
	var tmp = require(program.config);
	if (!tmp.serverIP) {
		logger.error("no serverIP defined");
		process.exit(1);
	} else {
		config.serverIP = tmp.serverIP;
	}
} else {
	logger.error("you must provide a config file");
	process.exit(1);
}

// the etcd client
var etcd = new Etcd(program.host, '4001');

function getHHRServices() {
	etcd.get('/services', {recursive: true}, function (err, resp) {
		if (err) {
			console.error("error ", err);
		} else {
			clearInterval(loop);
			if (resp.node.nodes) {
				resp.node.nodes.forEach(function (node) {
					if (node.key === "/services/HHR-Pro") {
						HHRPros[node.nodes[0].key] = JSON.parse(node.nodes[0].value);
					}
				});
			}

			watcher = etcd.watcher("/services", null, {recursive: true});
			watcher.on("change", function (action) {
				switch (action.action) {
					case 'set':
						if (action.node.key === "/services/HHR-Pro") {
							HHRPros[action.node.nodes[0].key] = JSON.parse(action.node.nodes[0].value);
						}
						break;
					case 'delete':
						if (action.node.key === "/services/HHR-Pro") {
							delete HHRPros[action.node.nodes[0].key];
						}
						break;
				}
			});
		}
	});
}

var CheckPassword = {
	loginservice: {
		loginserviceSOAP: {
			CheckPassword: function (CheckPasswordRequest, cb) {
				var soapReq = CheckPasswordRequest.CheckPasswordRequest;

				if (!soapReq || !soapReq.Authentifier || !soapReq.OrganizationalUnit || !soapReq.Password) {
					logger.error("Requete d'identification invalide");
					throw {
						Fault: {
							Code  : {
								Value  : "soap:Sender",
								Subcode: {value: "rpc:BadArguments"}
							},
							Reason: {Text: "Requete invalide"}
						}
					};
				}

				var CheckPasswordOut = {IsValid: false, CheckPasswordUserInfo: ""};

				function testPasswd(HHRPro, Authentifier, Password) {
					return new promise(function (resolve, reject) {
						request({
							url    : "http://" + HHRPro.dns + "/api/checkpasswd",
							method : "POST",
							headers: {"content-type": "text/plain"},
							body   : JSON.stringify({login: Authentifier, password: Password})
						}, function (err, resp, body) {
							if (err) {
								logger.debug("resp checkpasswd err", err);
								resolve({valid: false});
							} else {
								try {
									var isvalid = JSON.parse(body);
									resolve(isvalid);
								} catch (err) {
									resolve({valid: false});
								}
							}
						});
					});
				}

				var instances = [];
				for (var HHRPro in HHRPros) {
					instances.push(HHRPros[HHRPro]);
				}
				var promises = instances.map(function (HHRPro) {
					return testPasswd(HHRPro, soapReq.Authentifier, soapReq.Password);
				});

				var CheckPasswordOut = {IsValid: false, CheckPasswordUserInfo: ""};
				// @todo valid is a function that validate the user:

				RSVP.all(promises)
					.then(function (results) {
						var valid = false;
						for (var i = 0; i < results.length; i++) {
							valid = valid || results[i].valid;
						}
						if (valid) {
							logger.info("Authentifier valid", soapReq);
							CheckPasswordOut.IsValid = true;
							CheckPasswordOut.CheckPasswordUserInfo = "Authentifier=" + soapReq.Authentifier + ";OrganizationalUnit=" + soapReq.OrganizationalUnit + ";";
						} else {
							logger.alert("Authentifier not valid", soapReq);
							CheckPasswordOut.IsValid = false;
						}
						logger.trace({CheckPasswordResponse: CheckPasswordOut});
						cb({CheckPasswordResponse: CheckPasswordOut});
					});
			}
		}
	}
};

var xml = require('fs').readFileSync(__dirname + '/checkpassword.wsdl', 'utf8');
var server = http.createServer(function (req, res) {
	logger.trace("request to http server", req.method, req.url);

	var done = false;

	if (req.method === "GET" && ["/checkpassword.wsdl", "/wsdl"].indexOf(req.url) !== -1) {
		logger.trace("get the wsdl file");
		done = true;
		logger.debug("host", req.headers.host);
		// var serverName =  req.headers.host === "localhost"?"localhost:1234":req.headers.host;
		var serverName = req.headers.host;
		var wsdl = swig.render(xml, {locals: {server: serverName}});
		res.writeHead(200, {
			'Content-Length': wsdl.length,
			'Content-Type'  : 'application/xml'
		});
		res.end(wsdl);
	}
	if (!done) {
		res.statusCode = 404;
		res.end("404: Not Found: " + req.url);
	}
});

server.listen(8010, function () {
	logger.info("-----------------------------------------------");
	logger.info("server wsdl v" + pkg.version + " listen on 8010");
	logger.info("-----------------------------------------------");
	var wsdl = swig.render(xml, {locals: {server: config.serverIP}});
	soap.listen(server, '/login', CheckPassword, wsdl);
	// Watch for HHRPro instances
	getHHRServices();
});

