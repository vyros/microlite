
const express   = require('express')
const swaggerUi = require('swagger-ui-express')
const swaggerJson	= require('../swagger.json')
const apiAuthAuthorize	= "/oauth/authorize"
const apiAuthToken		= "/oauth/token"

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

module.exports = apiRouter