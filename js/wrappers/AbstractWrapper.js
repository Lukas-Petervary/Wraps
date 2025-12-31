/**
 * Required API for media playback service. Standardizes playback logic and number systems for media context.
 */
export default class AbstractWrapper {
    /** @return {string} the string ID of wrapper playback type */
    getType() { throw new Error(`[AbstractWrapper] getType()`) }

    /**
     * Plays the audio from the provided uri
     * @param {string} uri wrapper-specific url to parse and play
     */
    async playUri(uri) { throw new Error(`[AbstractWrapper] playUri("${uri}")`) }

    /**
     * Pauses playback of current track
     */
    async pause() { throw new Error("[AbstractWrapper] pause()") }

    /**
     * Resumes playback of current track
     */
    async resume() { throw new Error("[AbstractWrapper] resume()") }

    /**
     * @return {Promise<Number>} returns the current playback time of media (in seconds)
     */
    async getCurrentTime() { throw new Error("[AbstractWrapper] getCurrentTime()") }

    /**
     * @return {Promise<Number>} returns the total media length (in seconds)
     */
    async getDuration() { throw new Error("[AbstractWrapper] getDuration()") }

    /**
     * Sets the time of the current playing media
     * @param {Number} time the time to set current media
     */
    async seek(time) { throw new Error(`[AbstractWrapper] playUri("${time}")`) }

    /**
     * Sets the volume of the current wrapper
     * @param {Number} volume volume normalized 0...100 for the current wrapper
     */
    async setVolume(volume) { throw new Error(`[AbstractWrapper] setVolume(${volume})`) }
}

export class Track {
    constructor(source, id, uri, addedBy, title, author, duration) {
        this.source = source;
        this.id = id;
        this.uri = uri;
        this.title = title;
        this.author = author;
        this.duration = duration;
        this.addedBy = addedBy;

        this.time = 0;
        this.uuid = crypto.randomUUID();
    }

    toJSON() {
        return {
            source: this.source,
            id: this.id,
            uri: this.uri,
            title: this.title,
            author: this.author,
            duration: this.duration,
            addedBy: this.addedBy,
            uuid: this.uuid,
            time: this.time,
        };
    }

    static fromJSON({ source, id, uri, title, author, duration, addedBy, uuid }) {
        const v = new Track(source, id, uri, addedBy, title, author, duration);
        if (uuid) v.uuid = uuid;
        return v;
    }
}