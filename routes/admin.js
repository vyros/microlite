
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
