'use strict'

//  Get current location and run weather
const getPosition = function (options) {
    return new Promise(function (resolve, reject) {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
}

function getCurrentLocation() {
    return getPosition()
    .then(position => {
        const lat = position.coords.latitude
        const lon = position.coords.longitude
        console.log('Successful Geolocation: (' + lat + ', ' + lon + ')' )
        return getWeather(lat, lon, true)
    })
    .catch(e => {
        return fetch_retry('https://ipapi.co/json/')
        .then(response => {return response.json()})
        .then(json => {
            console.log('Successful IP Location: ' + json.ip + ' -> (' + json.latitude + ', ' + json.longitude + ')' )
            return getWeather(json.latitude, json.longitude, true)
        })
        .catch(e => {
            printError('Error getting current location.  Enter your location with a different method.')
            throw new Error(e)
        })
    })
}

function getRandomLocation() {
    const randCoords = randUSA()
    return getWeather(randCoords[0], randCoords[1], true)
}

//  Clear all child divs of an id
function clearID(id) {
    const node = document.getElementById(id)
    if (node !== null) {
        while (node.hasChildNodes()) {
            node.removeChild(node.lastChild);
        }
    }
}

function fetch_retry(url, options = {}, retries = 3) {
    if (url.startsWith("http://")) {
        url = "https" + url.slice(4)
    }

    const retryCodes = [408, 500, 502, 503, 504, 522, 524]
    return fetch(url, options)
    .then(res => {
        if (res.ok)
            return res
        if (retries > 0 && retryCodes.includes(res.status)) {
            return fetch_retry(url, options, --retries)
        } else {
            throw new Error(res)
        }
    })
    .catch(console.error)
}

//  Convert Celcius to Fahrenheit
function c2f(celcius) {
    return celcius * 9.0 / 5.0 + 32.0
}

//  Convert meters to feet
function m2ft(meters) {
    return (meters * 100) / (12 * 2.54)
}

//  Convert meters to inches
function m2in(meters) {
    return (meters * 100) / (2.54)
}


function generateDataInDateRange(gridProps, fields, startdate, enddate, zoneData) {
    let dataStruct = {}
    const certainFields=['quantitativePrecipitation','snowfallAmount']
    const zeroThreshold = 0.01
    fields.forEach(function (field, index) {
        if (!(field in gridProps )) {
            console.log('Error: ' + field + ' not in properties')
            return
        }

        const thisGridField = gridProps[field]
        const numPoints = thisGridField.values.length
        const entryStruct = {'time':new Array(), 'data':new Array(), 'unit':''}

        //  Extract parameter unit
        if ('uom' in thisGridField)
            entryStruct.unit = thisGridField.uom.split(':')[1]

        //  Create array of data
        for (let i = 0; i < numPoints; i++) {
            const gridInterval = luxon.Interval.fromISO(thisGridField.values[i].validTime)
            const gridStart = gridInterval.start.plus({minutes:zoneData.offset})

            if (gridStart <= enddate) {
                //  Repeat value for specified number of hours
                for (let h = 0; h < gridInterval.length('hours'); h++) {
                    const currentTime = gridStart.plus({hours:h})
                    if (currentTime >= startdate && currentTime <= enddate) {
                        entryStruct.time.push(currentTime)
                        if (certainFields.includes(field) )
                            entryStruct.data.push(thisGridField.values[i].value /  gridInterval.length('hours'))
                        else
                            entryStruct.data.push(thisGridField.values[i].value)

                    }
                }
            }
        }

        if (entryStruct.unit.includes('degC')) {
            for (let i = 0; i < entryStruct.data.length; i++) {
                entryStruct.data[i] = c2f(entryStruct.data[i])
            }
            entryStruct.unit = degreeSymbol + 'F'
        }
        else if (entryStruct.unit.includes('degF'))
            entryStruct.unit = degreeSymbol + 'F'
        if (entryStruct.unit == 'mm') {
            for (let i = 0; i < entryStruct.data.length; i++) {
                entryStruct.data[i] = entryStruct.data[i] / 25.4
            }
            entryStruct.unit = 'in'
        }
        dataStruct[field] = entryStruct
    })
    return dataStruct
}

//  Prints specified error
function printError(message) {
    d3.select('#errors').text(message)
}

// Get coordinate of location
function geocodeNominatim() {
    const searchText = document.getElementById("textinput").value
    const nominatimURL = 'https://nominatim.openstreetmap.org/search?q=' + searchText + '&countrycodes=us&format=json&limit=1'

    return fetch_retry(nominatimURL)
    .then(response => {return response.json()})
    .then(nomJson => {
        if (nomJson.length == 0) {
            const errorString = 'Error: Location not identifiable from \"' + searchText + '\".  Try again.'
            printError(errorString)
            throw new Error(errorString)
        }
        else {
            const lat = parseFloat(nomJson[0].lat)
            const lon = parseFloat(nomJson[0].lon)
            console.log('Nominatim geocode success: ' + searchText + ' -> (' + lat + ', ' + lon + ')' )
            return getWeather(lat, lon, false)
        }
    })
}

function geocodeArcgis(magic=null){
    const searchText = document.getElementById("textinput").value
    var arcgisURL = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?'
                            + 'f=json'
                            + '&SingleLine=' + searchText
                            + '&outFields=X,Y,address'

    if (magic) {
        arcgisURL += '&magicKey=' + magic
    }
    else {
        arcgisURL += '&sourceCountry=us'
    }

    return fetch_retry(arcgisURL)
    .then(response => {return response.json()})
    .then(json => {
        const lat = parseFloat(json.candidates[0].location.y)
        const lon = parseFloat(json.candidates[0].location.x)
        document.getElementById('textinput').value = json.candidates[0].address
        console.log('ArcGIS geocode success: ' + searchText + ' -> (' + lat + ', ' + lon + ')' )
        return getWeather(lat, lon, false)
    })
     .catch((e) => {
        console.log(e)
        return geocodeNominatim()
    })
}

function geocodeGeoapify() {
    const searchText = document.getElementById("textinput").value
    const geoapifyKey = 'b2c8246b8b8545b9bc1e814d5c90486a' // Get your own at geoapify.com
    const geoapifyURL = 'https://api.geoapify.com/v1/geocode/search?text=' + searchText
                            + '&lang=en' + '&limit=1' + '&type=city' + '&filter=countrycode:us' + '&apiKey=' + geoapifyKey

    return fetch_retry(geoapifyURL)
    .then(response => {return response.json()})
    .then(json => {
        const lat = parseFloat(json.features[0].geometry.coordinates[1])
        const lon = parseFloat(json.features[0].geometry.coordinates[0])
        console.log('Geoapify geocode success: ' + searchText + ' -> (' + lat + ', ' + lon + ')' )
        return getWeather(lat, lon, false)
    })
    .catch((e) => {
        console.log(e)
        return geocodeNominatim()
    })
}

function geocode() {
    return geocodeArcgis()
}

function reverseGeocode(lat,lon, zoom=14, cutCountry=true) {
    const url = 'https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lon + '&format=json&zoom=14'
    fetch_retry(url)
    .then(function(response) { return response.json(); })
    .then(function(reverseJson) {
        clearID('errors')
        if (reverseJson.error) {
            document.getElementById("textinput").value= lat.toFixed(5) + ', ' + lon.toFixed(5)
        }
        else {
            if (cutCountry) {
                reverseJson.display_name = reverseJson.display_name.slice(0, -(reverseJson.address.country.length + 2))
            }
            document.getElementById("textinput").value = reverseJson.display_name;
        }
    })
}


function eucDist(coord1,coord2) {
    return Math.sqrt(Math.pow(coord1[0] - coord2[0], 2) + Math.pow(coord1[1] - coord2[1], 2))
}


function help() {
    const button = document.getElementById('button3')
    const previouslyPushed = button.classList.contains('pushed')
    if (previouslyPushed)
        clearID('errors')
    else
        printError('Enter a location by using your current location, the text search box, or the map by double-click, right click, or long press (mobile).')
    button.classList.toggle('pushed')
}


function toggleButtonDisable() {
    document.getElementById('button0').classList.toggle('disabled')
    document.getElementById('button1').classList.toggle('disabled')
    document.getElementById('button2').classList.toggle('disabled')
    document.getElementById("textinput").toggleAttribute('readonly')
}

function button0Func() {
    const buttonElem = document.getElementById('button0')
    if (!buttonElem.classList.contains('disabled')) {
        toggleButtonDisable()
        getRandomLocation()
        .finally(() => {
            toggleButtonDisable()
        })
    }
}

function button1Func() {
    const buttonElem = document.getElementById('button0')
    if (!buttonElem.classList.contains('disabled')) {
        toggleButtonDisable()
        getCurrentLocation()
        .finally(() => {
           toggleButtonDisable()
        })
    }
}

function button2Func() {
    const buttonElem = document.getElementById('button0')
    if (!buttonElem.classList.contains('disabled')) {
        toggleButtonDisable()
        geocode()
        .finally(() => {
            toggleButtonDisable()
        })
    }
}

function alignTwoCharts(chartA, chartB, threshold = 0.001) {
    let leftDiff = 1
    let widthDiff = 1
    let count = 0
    while (Math.abs(leftDiff) > threshold && Math.abs(widthDiff) > threshold ) {
        leftDiff = chartA.chartArea.left - chartB.chartArea.left
        widthDiff = (chartA.chartArea.right - chartA.chartArea.left) - (chartB.chartArea.right - chartB.chartArea.left)

        if (leftDiff < 0)
            chartA.options.layout.padding.left -= leftDiff
        else
            chartB.options.layout.padding.left += leftDiff

        if (widthDiff < 0)
            chartB.options.layout.padding.right -=  widthDiff
        else
            chartA.options.layout.padding.right +=  widthDiff

        chartA.update()
        chartB.update()
        count += 1
    }
}

function alignChartAtoB(chartA, chartB, threshold = 0.001) {
    let leftDiff = 1
    let widthDiff = 1
    while (Math.abs(leftDiff) > threshold && Math.abs(widthDiff) > threshold ) {
        leftDiff = chartA.chartArea.left - chartB.chartArea.left
        widthDiff = (chartA.chartArea.right - chartA.chartArea.left) - (chartB.chartArea.right - chartB.chartArea.left)
        chartA.options.layout.padding.left -= leftDiff
        chartA.options.layout.padding.right +=  widthDiff
        chartA.update()
    }
}

function isArrayNonzero(array, threshold=0.01) {
    for (let i = 0; i < array.length; i++) {
        if (array[i] > threshold)
            return true
    }
    return false
}

function arrayToChartJSData(x,y) {
    const numPoints = x.length
    const data = Array(numPoints)
    for (let i = 0; i < numPoints; i++) {
        data[i] = {x:x[i],y:y[i]}
    }
    return data
}

function tooltipRoundValue(context, len=2) {
    var label = context.dataset.label || '';
    var value = context.dataset.interpolatedValue
    if (label) {
        label += ': ';
    }
    label += Number.parseFloat(value).toFixed(len)
    return label;
}
function tooltipRoundValue0(context) {
    return tooltipRoundValue(context, 0)
}
