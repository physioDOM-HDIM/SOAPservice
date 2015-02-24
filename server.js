var http = require("http"),
    soap = require("soap"),
    promise = require("rsvp").Promise,
    Logger = require("logger");

var logger = new Logger("WSDL service");
var serverIP = "http://192.168.1.31:8010";

var CheckPassword = {
	loginservice: {
		loginserviceSOAP: {
			CheckPassword: function( CheckPasswordRequest, cb ) {
				logger.debug("CheckPassword");
				
				if ( !CheckPasswordRequest.Authentifier ||!CheckPasswordRequest.OrganizationUnit || !CheckPasswordRequest.Password ) {
					logger.error( "Requete d'identification invalide" );
					throw {
						Fault: {
							Code: {
								Value: "soap:Sender",
								Subcode: { value: "rpc:BadArguments" }
							},
							Reason: { Text: "Requete invalide" }
						}
					};
				}
				
				logger.debug("CheckPasswordRequest", CheckPasswordRequest );
				var CheckPasswordOut = { isValid:false, CheckPasswordUserInfo:"" };
				// @todo valid is a function that validate the user:
				var valid = true;
				
				if( valid ) {
					CheckPasswordOut.isValid = true;
					CheckPasswordOut.CheckPasswordUserInfo = "Authentifier=03b.aynes@ids-assistance.com;OrganizationalUnit=Utilisateur;";
				} else {
					CheckPasswordOut.isValid = false;
				}
				return CheckPasswordOut; 
			}
		}
	}
};

function test1( ) {
	console.log( "test1" );
	return new promise( function( resolve, reject) {
		soap.createClient(serverIP+'/wsdl?wsdl', function(err, client) {
			client.CheckPassword({ Authentifier: 'login', OrganizationUnit:"User", Password:"password" }, function(err, result) {
				if( err ) {
					reject(err);
				} else {
					console.log("result", JSON.stringify(result,"",4));
					resolve( result );
				}
		 	});
		});
	});
};

function test3( ) {
	console.log( "test3" );
	return new promise( function( resolve, reject) {
		soap.createClient(serverIP+'/wsdl?wsdl', function(err, client) {
			client.CheckPassword({ OrganizationUnit:"User", Password:"password" }, function(err, result) {
				if( err ) {
					reject(err);
				} else {
					resolve( result );
				}
		 	});
		});
	});
};

function test2( ) {
	return new promise( function( resolve, reject) {
		soap.createClient(serverIP+'/wsdl?wsdl', function(err, client) {
			if( err ) {
				reject(err);
			} else {
				resolve( client );
			}
		});
	});
};

var xml = require('fs').readFileSync('checkpassword.wsdl', 'utf8');
var server = http.createServer(function(req,res) {
	logger.trace("request to http server");
	var done = false;
	if( req.method === "GET" && req.url === "/test1" ) {
		done = true;
		test1( )
			.then( function( result) {
				res.end( JSON.stringify(result,"",4));
			})
			.catch( function(err) {
				res.end("err \n"+JSON.stringify(result,"",4));
			});
	}
	if( req.method === "GET" && req.url === "/test2" ) {
		done = true;
		test2( )
			.then( function( result ) {
				res.end( "result \n"+ JSON.stringify(result,"",4)); 
			})
			.catch( function(err) {
				res.end("err \n"+JSON.stringify(result,"",4));
			});
	}
	if( req.method === "GET" && req.url === "/test3" ) {
		done = true;
		test3( )
			.then( function( result ) {
				res.end( "result \n"+ JSON.stringify(result,"",4)); 
			})
			.catch( function(err) {
				// res.end("err \n"+JSON.stringify(err,"",4));
				res.end( err.response.body );
			});
	}
	if( req.method === "GET" && req.url === "/checkpassword.wsdl" ) {
		logger.trace("get the wsdl file");
		done = true;
		res.writeHead(200, {
			'Content-Length': xml.length,
			'Content-Type': 'application/xml' });
		res.end( xml );
	}
	if( !done ) {
		res.end("404: Not Found: "+req.url);
	}
});

server.listen(8010);
soap.listen(server, '/wsdl', CheckPassword, xml);
