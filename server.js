var http = require("http"),
    soap = require("soap"),
    promise = require("rsvp").Promise,
    Logger = require("logger"),
	request = require("request"),
 	swig  = require('swig');

var logger = new Logger("WSDL service");
var serverIP = "10.122.31.126";

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
				
				function testPasswd( Authentifier, Password ) {
					return new promise( function(resolve, reject) {
						request({
							url    : "http://192.168.1.68/api/checkpasswd",
							method : "POST",
							headers: {"content-type": "text/plain"},
							body   : JSON.stringify({login: Authentifier, password: Password})
						}, function (err, resp, body) {
							if (err) {
								logger.debug("resp checkpasswd err", err);
								resolve( { valid: false });
							} else {
								try {
									var isvalid = JSON.parse(body);
									resolve( isvalid );
								} catch( err ) {
									resolve( { valid: false });
								}
							}
						});
					});
				}
				
				var CheckPasswordOut = {IsValid: false, CheckPasswordUserInfo: ""};
				// @todo valid is a function that validate the user:
				
				testPasswd( soapReq.Authentifier, soapReq.Password )
					.then( function( isvalid ) {
						var valid = isvalid.valid;
						if (valid) {
							logger.info("Authentifier valid", soapReq);
							CheckPasswordOut.IsValid = true;
							CheckPasswordOut.CheckPasswordUserInfo = "Authentifier=" + soapReq.Authentifier + ";OrganizationalUnit=" + soapReq.OrganizationalUnit + ";";
						} else {
							logger.alert("Authentifier not valid", soapReq);
							CheckPasswordOut.IsValid = false;
						}
						logger.trace( { CheckPasswordResponse: CheckPasswordOut } );
						cb({ CheckPasswordResponse: CheckPasswordOut });
					});
			}
		}
	}
};

var test = {};

test.test1 = function() {
	logger.trace("test1 : get a soap client");
	return new promise( function( resolve, reject) {
		soap.createClient("http://"+serverIP+'/wsdl', function(err, client) {
			if( err ) {
				reject(err);
			} else {
				resolve( client );
			}
		});
	});
};

test.test2 = function() {
	logger.trace( "test2 : checkpasswd valid" );
	return new promise( function( resolve, reject) {
		soap.createClient("http://"+serverIP+'/wsdl', function(err, client) {
			var request = { CheckPasswordRequest:{ Authentifier: '03thomas.jabouley@viveris.fr', OrganizationalUnit:"User", Password:"test" }};
			client.CheckPassword(request, function(err, result, raw) {
				if( err ) {
					reject(err);
				} else {
					console.log(raw);
					resolve( result );
				}
		 	});
		});
	});
};

test.test3 = function() {
	logger.trace( "test3 : checkpasswd not valid" );
	return new promise( function( resolve, reject) {
		soap.createClient("http://"+serverIP+'/wsdl', function(err, client) {
			client.CheckPassword({ CheckPasswordRequest:{ OrganizationalUnit:"User", Password:"test" }}, function(err, result) {
				if( err ) {
					reject(err);
				} else {
					resolve( result );
				}
		 	});
		});
	});
};

test.test4 = function() {
	logger.trace( "test4 : checkpasswd not valid ( bad password )" );
	return new promise( function( resolve, reject) {
		soap.createClient("http://"+serverIP+'/wsdl', function(err, client) {
			client.CheckPassword( { CheckPasswordRequest:{ Authentifier: 'thomas.jabouley@viveris.fr', OrganizationalUnit:"User", Password:"test2" }} , function(err, result) {
				if( err ) {
					reject(err);
				} else {
					resolve( result );
				}
			});
		});
	});
};

test.test5 = function() {
	logger.trace( "test2 : checkpasswd valid" );
	return new promise( function( resolve, reject) {
		soap.createClient("http://"+serverIP+'/wsdl', function(err, client) {
			client.CheckPassword({ Authentifier: '03thomas.jabouley@viveris.fr', OrganizationalUnit:"User", Password:"test" }, function(err, result) {
				if( err ) {
					reject(err);
				} else {
					resolve( result );
				}
			});
		});
	});
};

var xml = require('fs').readFileSync('checkpassword.wsdl', 'utf8');
var server = http.createServer(function(req,res) {
	logger.trace("request to http server", req.method, req.url );
	var fn = test[req.url.slice(1)];
	var done = false;
	if( req.method === "GET" && fn ) {
		done = true;
		fn()
			.then( function( result ) {
				res.end( JSON.stringify(result,"",4));
			})
			.catch( function(err) {
				if( err.body ) {
					// var serverName =  req.headers.host === "localhost"?"localhost:1234":req.headers.host;
					var serverName = req.headers.host;
					var errXML = swig.render( err.body, { locals: { server: serverName } } );
					res.writeHead(200, {
						'Content-Length': errXML.length,
						'Content-Type': 'application/xml' });
					res.end( errXML );
				} else {
					res.end("err \n" + JSON.stringify(result, "", 4));
				}
			});
	}
	
	if( req.method === "GET" && ["/checkpassword.wsdl","/wsdl"].indexOf(req.url) !== -1 ) {
		logger.trace("get the wsdl file");
		done = true;
		logger.debug("host",req.headers.host );
		// var serverName =  req.headers.host === "localhost"?"localhost:1234":req.headers.host;
		var serverName = req.headers.host;
		var wsdl = swig.render( xml, { locals: { server: serverName } } );
		res.writeHead(200, {
			'Content-Length': wsdl.length,
			'Content-Type': 'application/xml' });
		res.end( wsdl );
	}
	if( !done ) {
		res.statusCode = 404;
		res.end("404: Not Found: "+req.url);
	}
});

server.listen(8010, function() {
	var pkg = require("./package.json");
	logger.info("-----------------------------------------------");
	logger.info("server wsdl v"+pkg.version+" listen on 8010" );
	logger.info("-----------------------------------------------");
	var wsdl = swig.render( xml, { locals: { server: serverIP } } );
	soap.listen(server, '/login', CheckPassword, wsdl);
});

