const bent = require('bent')
const path = require('path')
const yaml = require('js-yaml')
const fs = require('fs')
const fsp = require('fs').promises
const dom = require('xmldom').DOMParser
const xpath = require('xpath')
const sdgMetadataConvert = require('sdg-metadata-convert')
const seriesDescriptor = sdgMetadataConvert.descriptorStore.getDescriptor('SERIES')
const seriesOptions = seriesDescriptor.options

let xmlString
//const source = 'global-metadata.xml'
const source = 'https://unstats.un.org/SDGMetadataAPI/api/Metadata/SDMXReport/G.ALL.1'
harvestMetadata()

async function harvestMetadata() {
    if (source.startsWith('http')) {
        const getString = bent('string')
        xmlString = await getString(source)
    }
    else {
        xmlString = await fsp.readFile(source, { encoding: 'utf-8' })
    }

    const doc = new dom().parseFromString(xmlString)

    const namespaces = {
        mes: 'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message',
        com: 'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common',
        gen: 'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/metadata/generic',
    }
    const select = xpath.useNamespaces(namespaces)

    const metadataByIndicator = {}
    const metadataSets = select('.//mes:MetadataSet', doc)
    for (const metadataSet of metadataSets) {
        const series = select('.//com:KeyValue[@id="SERIES"]/com:Value', metadataSet, true)
        const seriesCode = series.firstChild.nodeValue
        const indicatorIds = getIndicatorIdsFromSeries(seriesCode)
        const concepts = select('.//gen:ReportedAttribute', metadataSet)
        const conceptValues = {}
        for (const concept of concepts) {
            const conceptId = concept.getAttribute('id')
            const conceptValue = select('string(./com:Text)', concept)
            // Change \r\n to \n.
            conceptValues[conceptId] = conceptValue.replace(/\r\n/g, '\n')
        }
        for (const indicatorId of indicatorIds) {
            metadataByIndicator[indicatorId] = conceptValues
        }
    }

    for (const indicatorId of Object.keys(metadataByIndicator)) {
        const filename = indicatorId.replace(/\./g, '-') + '.yml'
        const filepath = path.join('translations-metadata', 'en', filename)
        const yamlStr = yaml.dump(metadataByIndicator[indicatorId])
        fs.writeFileSync(filepath, yamlStr, 'utf8')
    }
}

function getIndicatorIdsFromSeries(seriesCode) {
    const series = seriesOptions.find(option => option.key === seriesCode)
    if (!series) {
        throw new InputError(`WARNING: Series with code "${seriesCode}" could not be found.`)
    }
    else {
        return series.indicatorIds
    }
}
