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
        console.log(position)
        return getWeather(position.coords.latitude, position.coords.longitude, true)
    })
    .catch(e => {
        printError('Error getting current location.  Enter your location with a different method.')
        throw new Error(e)
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

function fetch_retry(url, options = {}, retries = 0) {
    const retryCodes = [408, 500, 502, 503, 504, 522, 524]
    return fetch(url, options)
    .then(res => {
        if (res.ok)
            return res
        else {
            throw new Error('fetch response not ok')
        }
    })
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
        if (field in gridProps) {
            const thisGridField = gridProps[field]
            const numPoints = thisGridField.values.length
            const entryStruct = {'time':new Array(), 'data':new Array(), 'unit':''}

            //  Extract parameter unit
            if ('uom' in thisGridField)
                entryStruct.unit = thisGridField.uom.split(':')[1]

            //  Create array of data
            for (let i = 0; i < numPoints; i++) {
                const gridInterval = luxon.Interval.fromISO(thisGridField.values[i].validTime)

                if (gridInterval.start <= enddate) {
                    //  Repeat value for specified number of hours
                    for (let h = 0; h < gridInterval.length('hours'); h++) {
                        const currentTime = gridInterval.start.plus({hours:h}).setZone(zoneData.zone)
                        if (currentTime >= startdate && currentTime <= enddate) {
                            entryStruct.time.push(currentTime.plus({minutes:zoneData.offset}))
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
        }
        else {
            console.log('Error: ' + field + ' not in properties')
        }
    })
    return dataStruct
}

//  Prints specified error
function printError(message) {
    d3.select('#errors').text(message)
}

// Get coordinate of location
function geocode(location=document.getElementById("textinput")) {
    const url = 'https://nominatim.openstreetmap.org/search?q=' + location.value + '&countrycodes=us&format=json&limit=1'
    return fetch_retry(url, {method:'GET'}, 5)
    .then(response => {
        return response.json()
    })
    .then(nomJson => {
        if (nomJson.length == 0) {
            const errorString = 'Error: Location not identifiable from \"' + location.value + '\".  Try again.'
            printError(errorString)
            throw new Error(errorString)
        }
        else {
            const lat = parseFloat(nomJson[0].lat)
            const lon = parseFloat(nomJson[0].lon)
            console.log('Geocode success: ' + location.value + ' -> (' + lat + ', ' + lon + ')' )
            return getWeather(lat, lon, false)
        }
    })
}

function reverseGeocode(lat,lon, zoom=14, cutCountry=true) {
    const url = 'https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lon + '&format=json&zoom=14'
    fetch_retry(url, {method:'GET'}, 5)
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
            chartA.config.options.layout.padding.left -= leftDiff
        else
            chartB.config.options.layout.padding.left += leftDiff

        if (widthDiff < 0)
            chartB.config.options.layout.padding.right -=  widthDiff
        else
            chartA.config.options.layout.padding.right +=  widthDiff
        
        chartA.update()
        chartB.update()
        count += 1
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

function tooltipRoundValue(tooltipItem, data, len=2) {
    var label = data.datasets[tooltipItem.datasetIndex].label || '';

    if (label) {
        label += ': ';
    }
    if (Number.isInteger(tooltipItem.yLabel))
        label += tooltipItem.yLabel
    else
        label += Number.parseFloat(tooltipItem.yLabel).toFixed(len)
    return label;
}
function tooltipRoundValue0(tooltipItem, data) {
    return tooltipRoundValue(tooltipItem, data, 0)
}
