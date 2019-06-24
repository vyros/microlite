const mongoose  = require("mongoose")
const Schema    = mongoose.Schema;
const ObjectId  = Schema.ObjectId;

// AID=0230111&GID=0034021&CPM=15&ACPM=13.2&uSV=0.075
const Geiger = new Schema({
    id: { type: ObjectId },
    aid: String,
    gid: String,
    cpm: Number,
    acpm: Number,
    usv: Number,
    location: String,
    date: { type: Date, default: Date.now, index: false },
})

Geiger.virtual('fullObject').get(_ => {
    return this.aid + ' ' + this.gid
});

module.exports = mongoose.model('Geiger', Geiger);