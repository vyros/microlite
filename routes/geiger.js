
// Geiger API (only GET /?)
// ======================
const apiGeiger	= express.Router()
apiGeiger.get(`${apiPath}`, (req, res, next) =>{
	setStatusAndThrowError(res, 418, "You send a query")
})
app.use(`${apiRoot}${apiVersion}`, apiGeiger)
