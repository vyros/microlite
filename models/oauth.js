
module.exports = OauthModel;

function OauthModel(options = {}) {
	if(!(this instanceof OauthModel)){
		return new OauthModel(options);
	}

	if(!(options.authorizationCodeStore ||
		options.accessTokenStore ||
		options.refreshTokenStore ||
		options.clientRegistry)){
		throw "stores or client registry not provided";
	}

	var self = this;

	self.authorizationCodeStore = options.authorizationCodeStore;
	self.accessTokenStore = options.accessTokenStore;
	self.refreshTokenStore = options.refreshTokenStore;
	self.clientRegistry = options.clientRegistry;

	return self;
}

OauthModel.prototype.getClient = async function(clientId, clientSecret){
	var self = this,
		registry = self.clientRegistry,
		client;

	client = registry.clients[clientId];

	if(!client){
		return null;
	}

	//the clientSecret is not needed in the 'authorize' phase using 'code' response type
	if(clientSecret && client.clientSecret != clientSecret){
		return null;
	}

	return client;
}

Client: {
    id: String
    clientSecret: String
    grants: [ String ]
    redirectUris: [ String ]
}