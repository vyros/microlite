// BASE SETUP
// ==========

// Call the packages we need
const bodyParser	= require('body-parser')
const cookieParser	= require('cookie-parser')
const compression	= require('compression')
const config		= require('./swagger.json')
const cors			= require('cors')
const express		= require('express')
const app			= express()
const exphbs 		= require('express-handlebars')
const OAuth2Server	= require('express-oauth-server')
const fs			= require('fs')
const http			= require('http')
const https			= require('https')
const mongoose		= require('mongoose')
const morgan		= require('morgan')
const path 			= require('path')
const swaggerUi		= require('swagger-ui-express')
const swaggerJson	= require('./swagger.json')
const winston		= require('winston')

// Constants
const hostname			= 'localhost'
const port				= process.env.PORT || 3000
const apiRoot			= "/api"
const apiTrueVersion	= "0.5.0"
const apiEnvironment	= 'dev'
//const apiVersion		= `/v${apiTrueVersion.charAt(0)}`
const apiVersion		= `/v1`
const apiPath			= "/geiger"
const apiAuthAuthorize	= "/oauth/authorize"
const apiAuthToken		= "/oauth/token"
const apiTitle			= apiPath.split('/')[1].charAt(0).toUpperCase() + apiPath.split('/')[1].slice(1)
const adminRoot			= "/admin"
const timestamp			= Math.floor(Date.now() / 1000 / 60 / 60)
process.env.NODE_ENV 	= config.environment


// DATABASE CONNECTION
// ===================
const Geiger = require('./models/geiger.js')
mongoose.connect('mongodb://localhost:27017/geiger', {useNewUrlParser: true})


// CONFIGURE WINSTON
// =================
const logger = winston.createLogger({
	level: 'info',
	format: winston.format.json(),
	transports: [
		new winston.transports.File({ filename: 'error.log', level: 'error' }),
		new winston.transports.File({ filename: 'combined.log' }),
	]
})
if (process.env.NODE_ENV !== 'production') {
	logger.add(new winston.transports.Console({
		level:'info',
		format: winston.format.simple(),
	}))
}


// CONFIGURE SERVERS
// =================
var httpServer	= http.createServer(app)
var httpSecured	= https.createServer({
	key: fs.readFileSync('localhost-privkey.pem', 'utf8'), 
	cert: fs.readFileSync('localhost-cert.pem', 'utf8')
}, app)

// Configure OAuth2
var options = {
	useErrorHandler: false,
	continueMiddleware: false,
}
const oauth = new OAuth2Server({
	model: require('./models/oauth'), // See https://github.com/oauthjs/node-oauth2-server for specification
	options: options,
	allowBearerTokensInQueryString: true,
	accessTokenLifetime: 4 * 60 * 60
})


// CONFIGURE THIRD-PARTY MIDDLEWARE
// ================================
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(cookieParser())
app.use(compression())
app.use(morgan("dev")); // Funcy log requests to the console
//app.enable('trust proxy')
app.disable('x-powered-by')


// STATICS, LAYOUTS AND VIEWS
// ==========================
app.use(express.static('public'))
app.engine('.hbs', exphbs({
	defaultLayout: 'main',
	extname: '.hbs',
	layoutsDir: path.join(__dirname, 'views/layouts')
}))
app.set('view engine', '.hbs')
app.set('views', path.join(__dirname, 'views'))


// MIDDLEWARES
// ===========

// Middleware to use for ALL incoming requests
app.use((req, res, next) => {
	logger.info(`Incoming request ${req.method} for ${req.path}`)
	if (!req.secure) res.redirect(`https://${req.headers.host.split(':')[0]}:${parseInt(req.headers.host.split(':')[1]) + 1}${req.url}`)
	else next()
})


// DEFAULT ROUTER
// ==============
const defaultRouter = express.Router()
var getFirstnameFromQueryRequest = (req) => {
	return (req.query.firstname) ? req.query.firstname : 'Anonymous'
}
defaultRouter
.get('/',  cors(), (req, res) => {
	res.render('home', {
		title: swaggerJson.info.title,
		firstname: getFirstnameFromQueryRequest(req)
	})
})
.all('/secret', (req, res, next) => {
	try {
		logger.warn(`Accessing the secret section (${req.method})`)
		let secret = req.headers.secret 
		if (!secret || secret !== 'true') setStatusAndThrowError(res, 401, `Secret header is ${secret}`)
	} catch (error) {
		serverErrorHandler(error)
	} finally {
		next()
	}
})
app.use('/', defaultRouter)


// ADMIN SUB-APP
// =============
var logRequestedAccess = (req, _, next) => {
	logger.info(`Access requested to ${req.originalUrl}`)
	next()
}
var adminAuthentication = (req, _, next) => {
	let admin = req.headers.admin 
	if (!admin || admin !== 'true')	throw new Error("Authentication required")
	next()
}
var logSuccessfulAccess = (req, _, next) => {
	logger.info(`Successful access to ${req.originalUrl}`)
	next('route')
}
var adminMiddlewares = [ logRequestedAccess, adminAuthentication, logSuccessfulAccess ]
const adminApp = express()
adminApp.on('mount', (parent) => {
	logger.info(`Admin Mounted on https://${hostname}:${port}${adminApp.mountpath}`)
	//logger.info(parent) // refers to the parent app
})
adminApp.get('/', adminMiddlewares, (req, res, next) => {
	res.send('Admin Homepage skipped by next(route)')
})
adminApp.get('/', (req, res, next) => {
	res.send('Admin Homepage not skipped')
})
app.use(`${adminRoot}`, adminApp)


// MISCEALLANEOUS
// ==============

// Custom middleware that checks if req.body has content or not.
var checkNoContent = (req, res, next) => {
	if (Object.keys(req.body).length === 0) return res.status(204).send()
	next()
}
var checkQuery = (req, _, next) => {
	if (Object.keys(req.query).length !== 0) next('router')
	next()
}
var setStatusAndThrowError = (res, code, message) => {
	res.status(code)
	throw new Error(message)
}

// API ROUTER
// ==========
const apiRouter	= express.Router()
apiRouter

// Version
.get('/version', (_, res) => {
	res.status(200).json({ version: apiTrueVersion })
})

// Swagger
.use('/', swaggerUi.serve)
.get('/swagger', swaggerUi.setup(swaggerJson))

// Authentication
.get(`${apiAuthAuthorize}`, oauth.authorize(), (req, res) => {
	var { authorization } = req.headers
	if (!authorization) setStatusAndThrowError(res, 401, 'You must send an Authorization header')

	var [authType, token] = authorization.trim().split(' ')
	if (authType !== 'Bearer') setStatusAndThrowError(res, 401, 'Expected a Bearer token')

	res.status(200).send()
})
.get(`${apiAuthToken}`, oauth.token(), (_, res) => {
	res.status(200).json({ message: 'You got It!' })
})

// Main API routes
.route(`${apiPath}`)
	// .options((req, res) => {
	// 	res.set({
	// 		'Access-Control-Allow-Origin': req.headers.origin,
	// 		'Vary': 'Origin'
	// 	})
	// 	res.status(200).end()
	// })
	.get(checkQuery, (_, res, next) => {
		Geiger.find({})
		.then(entries => {
			res.status(200).json(entries)
		})
		.catch(err => {
			next(err)
		})
	})
	.post(checkNoContent, (req, res, next) => {
		let geiger = new Geiger(req.body)
		Geiger.create(geiger)
		.then(entry => {
			res.set({
				'Location': `${req.path}/${entry._id}`,
			})
			res.status(201).json({id: entry._id})
		})
		.catch(err => {
			next(err)
		})
	})
	// .put((_, res) => {
	// 	res.status(405).send()
	// })
	// .patch((_, res) => {
	// 	res.status(405).send()
	// })
	// .delete((_, res) => {
	// 	res.status(405).send()
	// })

apiRouter
.route(`${apiPath}/:id`)
	.get((req, res, next) => {
		Geiger.findById(req.params.id)
		.then(entry => {
			if (!entry) setStatusAndThrowError(res, 404, "Object Not Found")
			res.status(200).json(entry)
		})
		.catch(err => {
			next(err)
		})
	})
	.patch(checkNoContent, (req, res, next) => {
		req.body._id = req.params.id
		let geiger = new Geiger(req.body)
		Geiger
		.findByIdAndUpdate(req.params.id, geiger)	
		.then(entry => {
			if (!entry) setStatusAndThrowError(res, 404, "Object Not Found")
			res.status(200).send()
		})
		.catch(err => {
			next(err)
		})
	})
	.put(checkNoContent, (req, res, next) => {
		req.body._id = req.params.id
		let geiger = new Geiger(req.body)
		Geiger.findByIdAndDelete(req.params.id)
		.then(entry => {
			Geiger.create(geiger)
			.then(() => {
				(!entry) ? res.status(201) : res.status(200)
				res.send()
			})
			.catch(err => {
				next(err)
			})
		})
		.catch(err => {
			next(err)
		})
	})
	.delete((req, res, next) => {
		req.body._id = req.params.id
		Geiger.findByIdAndDelete(req.params.id)
		.then(entry => {
			if (!entry) setStatusAndThrowError(res, 404, "Object Not Found")
			res.status(200).send(`Bye bye ${(entry.title) ? entry.title : "object"}`)
		})
		.catch(err => {
			next(err)
		})
	})

app.use(`${apiRoot}${apiVersion}`, apiRouter)


// Geiger API (only GET /?)
// ======================
const apiGeiger	= express.Router()
apiGeiger.get(`${apiPath}`, (req, res, next) =>{
	setStatusAndThrowError(res, 418, "You send a fucking query")
})
app.use(`${apiRoot}${apiVersion}`, apiGeiger)


// 404 HANDLER
// ===========
app.all('*', (_, res) => {
	setStatusAndThrowError(res, 501, "Method not found")
})


// ERROR HANDLING
// ==============
var serverErrorHandler = (error) => {
	logger.error(`Something bad happened server side: ${error.stack}`)
}
var clientErrorHandler = (error) => {
	logger.error(`Something bad happened client side : ${error}`)
}
app.use((err, req, res, next) => {
	clientErrorHandler(err)
	res.json({ message: err.message })
})


// START SERVERS
// =============
httpServer.listen(port, (err) => {
	if (err) return serverErrorHandler(err)
})
httpSecured.listen(port + 1, (err) => {
	if (err) return serverErrorHandler(err)

	logger.info(`API running at https://${hostname}:${port}${apiRoot}${apiVersion}${apiPath}`)
})
