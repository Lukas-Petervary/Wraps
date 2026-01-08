const STORAGE_KEY = "site-theme";
const root = document.documentElement;

function applyTheme(theme) {
    root.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
}

function getSavedTheme() {
    return localStorage.getItem(STORAGE_KEY)
        || (window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light");
}

applyTheme(getSavedTheme());

function toggleTheme() {
    applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
}

const getWidget = async () => new Promise(async (resolve, reject) => {
    let itr = 0;
    let themeButton = document.getElementById('themeToggle');
    while (!themeButton) {
        if (itr > 128) reject("Widget fetch timeout reached");
        await new Promise((r) => setTimeout(r, 100));
        themeButton = document.getElementById('themeToggle');
        itr++;
    }
    resolve(themeButton);
});

window.addEventListener('load', () => getWidget()
    .then((widget) => widget.addEventListener('click', toggleTheme))
    .catch(() => console.error('Failed to load theme change'))
);
