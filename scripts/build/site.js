module.exports = function(refresh=false) {

    const fs = require('fs')
    const path = require('path')
    const store = require('../translation-store')
    const { conceptStore } = require('sdg-metadata-convert')
    const bent = require('bent')
    const getJSON = bent('json')

    if (refresh) {
        store.refresh()
    }

    // We need to put a file in www/_data for Jekyll to use.
    const destinationFolder = path.join('www', '_data')
    const jekyllData = {
        metadata: store.getTranslationStore(),
        // For the site's purposes we would like fields in the pre-2020 order.
        fields: store.getFields('iaeg').map(cid => conceptStore.getConcept(cid)),
        // The 't' namespace contains all miscellaneous translations.
        t: store.getMiscellaneousTranslationStore(),
    }

    fs.writeFileSync(path.join(destinationFolder, 'store.json'), JSON.stringify(jekyllData), 'utf8')

    // We also need a file for the translation statistics.
    const headers = {
        'Authorization': 'Token ' + process.env.WEBLATE_API_TOKEN
    }

    const languageProperties = [
        'total',
        'approved',
        'failing',
        'fuzzy',
    ]

    writeStatistics()
    async function writeStatistics() {
        const stats = await getStatistics()
        fs.writeFileSync(path.join(destinationFolder, 'stats.json'), JSON.stringify(stats), 'utf8')
    }

    async function getStatistics() {
        const components = await getJSON('https://hosted.weblate.org/api/projects/sdg-metadata/components/', headers)
        const languages = {}
        for (const component of components.results) {
            const stats = await getJSON(component.statistics_url, headers)
            for (const language of stats.results) {
                if (typeof languages[language.code] === 'undefined') {
                    languages[language.code] = {}
                    for (const prop of languageProperties) {
                        languages[language.code][prop] = 0
                    }
                }
                languages[language.code][component.slug] = language
                for (const prop of languageProperties) {
                    languages[language.code][prop] += language[prop]
                }
            }
        }
        for (const lang of Object.keys(languages)) {
            for (const prop of languageProperties) {
                const percentProp = prop + '_percent'
                const percent = Math.round((languages[lang][prop] / languages[lang].total) * 100)
                languages[lang][percentProp] = percent
            }
        }
        return languages
    }
}
