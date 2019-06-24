
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
