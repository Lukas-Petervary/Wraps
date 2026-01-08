class StaticPartial extends HTMLElement {
    static observedAttributes = ["src", "params"];
    static cache = new Map();

    constructor() {
        super();
    }

    async setHtml(src, params) {
        const keys = JSON.parse(params || "{}");

        try {
            let html = await this.getFile(src);

            for (const [key, value] of Object.entries(keys)) {
                const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
                html = html.replace(regex, value);
            }

            this.innerHTML = html;
            await this.loadNestedPartials();
        } catch (err) {
            console.error("StaticPartial error:", err);
            this.innerHTML = `<p style="color:red;">Error loading partial: ${err.message}</p>`;
        }
    }

    async getFile(url) {
        if (StaticPartial.cache.has(url)) {
            return StaticPartial.cache.get(url);
        }

        const cached = sessionStorage.getItem(`partial:${url}`);
        if (cached) {
            StaticPartial.cache.set(url, cached);
            return cached;
        }

        const response = await fetch(url, { cache: "reload" });
        if (!response.ok)
            throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);

        const text = await response.text();
        StaticPartial.cache.set(url, text);
        sessionStorage.setItem(`partial:${url}`, text);
        return text;
    }

    async loadNestedPartials() {
        const nested = this.querySelectorAll("static-partial");
        const tasks = Array.from(nested).map(el => {
            const src = el.getAttribute("src");
            const params = el.getAttribute("params") || "";
            return el.setHtml(src, params);
        });
        await Promise.all(tasks);
    }

    connectedCallback() {
        if (this.hasAttribute("src")) {
            this.setHtml(this.getAttribute("src"), this.getAttribute("params") || "");
        }
    }
}

customElements.define("static-partial", StaticPartial);
