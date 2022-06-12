'use strict'

const fetchOptions = {
    method:'GET',
}

//  Create text search box
var mapDrawn = false
var mark
var colorScheme = d3.schemeSet2

function conditionPlotter(canvas, timeAxis1, dataPoints, syncIndex, lat, lon, timeRange, zoneData) {
    const timeAxis = {...timeAxis1}
    timeAxis.ticks = {display: false}
    const sunRiseSet = getSunriseSunset(lat, lon, timeRange[0], zoneData)

    const intensityMap = {
        null: 0,
        "very light": 0.25,
        "light": 0.5,
        "moderate": 0.75,
        "heavy": 1,
    }
    const weatherText = []
    const annotations = {}
    for (let i = 0; i < dataPoints.weather.data.length-1; i++) {
        // Get largest intensity weather condition provided
        var thisIntensityVal = 0
        var thisIntensityKey = null
        var d = dataPoints.weather.data[i][0]
        for (let j = 0; j < dataPoints.weather.data[i].length; j++) {
            if (intensityMap[dataPoints.weather.data[i][j].intensity] > thisIntensityVal) {
                thisIntensityVal = intensityMap[dataPoints.weather.data[i][j].intensity]
                thisIntensityKey = dataPoints.weather.data[i][j].intensity
                d = dataPoints.weather.data[i][j]
            }
        }
        const skyCover = dataPoints.skyCover.data[i]
        var color
        if (thisIntensityVal > 0) {
            if (d.weather != null && d.weather.includes("snow")) {
                color = d3.interpolatePurples(thisIntensityVal)
            }
            else {
                color = d3.interpolateBlues(thisIntensityVal)
            }
            
            var weatherString = d.weather === null ? "" : d.weather
            var intensityString = thisIntensityKey === null ? "" : thisIntensityKey
            var weatherString2 = intensityString
            if (weatherString2 != "" && weatherString != "") {
                weatherString2 += " "
            }
            weatherString2 += weatherString.replace("_"," ")
            weatherText.push(weatherString2)
        }
        else {
            color = d3.interpolateGreys(0.0075 * skyCover)
            weatherText.push(skyCover.toString() + "% clouds")
        }
        annotations[i] = {
            type: 'box',
            xMin: dataPoints['weather'].time[i].toJSDate(),
            xMax: dataPoints['weather'].time[i].plus({hour: 1}).toJSDate(),
            yMin: 0,
            yMax: 1,
            backgroundColor: color,
            borderWidth: 1,
            borderColor: color,
        }
    }

    const config = {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Line',
                    data: arrayToChartJSData(dataPoints.weather.time, Array(dataPoints.weather.time.length).fill(0.5)),
                    fill: false,
                    lineWidth: 0,
                    borderColor:  "rgba(0,0,0,0)",
                    backgroundColor: "rgba(0,0,0,0)",
                    interpolate: true,
                    yAxisID:'y',
                    xAxisID:'x',
                },
                
            ]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                x: timeAxis,
                y: {
                    scaleLabel: {
                        display: false,
                        labelString: 'Temperature ' + degreeSymbol + 'F',
                    },
                    ticks: {
                        display: false,
                        callback: function(value) {
                            return  value + degreeSymbol;
                        },
                    },
                    grid: {
                        display: false,
                    },
                    type: 'linear',
                    axis:'y',
                    min: 0,
                    max: 1,
                }
            },
            plugins: chartJSPlugins(syncIndex),
        },
    }
    config.options.plugins.tooltip.callbacks.label = (context) => {
        const x = context.element.x
        const index = Math.floor((x - context.parsed.x) / (60 * 60 * 1000 ))
        // console.log(context) 
        return weatherText[index]
    }
    config.options.plugins.tooltip.displayColors = false
    config.options.plugins.tooltip.callbacks.title = () => {}
    config.options.plugins.legend = {display:false}
    config.options.plugins.title = {
        display: true,
        text: 'Sunrise: ' + 
            sunRiseSet.sunrise.toLocaleString({ hour: '2-digit', minute: '2-digit', hour12: true }) + 
            ',  Sunset: ' + 
            sunRiseSet.sunset.toLocaleString({ hour: '2-digit', minute: '2-digit', hour12: true }),
    }
    config.options.plugins.autocolors = false
    config.options.plugins.annotation = {annotations:annotations}
    const chart = new Chart(canvas, config)
    return chart
}

function temperaturePlotter(canvas, timeAxis, dataPoints, syncIndex) {
    var tMax = Math.max(...dataPoints['temperature'].data)
    var tMin = Math.min(...dataPoints['temperature'].data)
    const tempChartConfig = {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Temperature',
                    data: arrayToChartJSData(dataPoints['temperature'].time, dataPoints['temperature'].data),
                    fill: false,
                    cubicInterpolationMode: 'monotone',
                    borderColor:  colorScheme[0],
                    backgroundColor: colorScheme[0],
                    interpolate: true,
                    yAxisID:'temp',
                    xAxisID:'x',
                },
                
            ]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                x: timeAxis,
                temp: {
                    scaleLabel: {
                        display: false,
                        labelString: 'Temperature ' + degreeSymbol + 'F',
                    },
                    ticks: {
                        callback: function(value) {
                            return  value + degreeSymbol;
                        },
                    },
                    type: 'linear',
                    axis:'y',
                }
            },
            plugins: chartJSPlugins(syncIndex),
        },
    }
    
    var plotApparent = false;
    for (let i = 0; i < dataPoints.apparentTemperature.data.length; i++) {
        if (Math.abs(dataPoints.apparentTemperature.data[i] - dataPoints.temperature.data[i]) > 0.5) {
            plotApparent = true
            break
        }
    }
    
    if (plotApparent) {
        tMax = Math.max(tMax, Math.max(...dataPoints['apparentTemperature'].data))
        tMin = Math.min(tMax, Math.min(...dataPoints['apparentTemperature'].data))
        tempChartConfig.data.datasets.push({
            label: 'Feels Like',
            data: arrayToChartJSData(dataPoints['apparentTemperature'].time, dataPoints['apparentTemperature'].data),
            fill: false,
            cubicInterpolationMode: 'monotone',
            borderColor:  colorScheme[1],
            backgroundColor: colorScheme[1],
            interpolate: true,
            yAxisID:'temp',
            xAxisID:'x',
        })
    }
    const tempRange = tMax - tMin
    if (tempRange < 10) {
        const offset = 0.5 * (10 - tempRange)
        tempChartConfig.options.scales.temp['suggestedMax'] = Math.ceil(tMax + offset)
        tempChartConfig.options.scales.temp['suggestedMin'] = Math.floor(tMin - offset)
    }
    const tempChartJS = new Chart(canvas, tempChartConfig)
    return tempChartJS
}

function precipPlotter(canvas, timeAxis, dataPoints, syncIndex){
    const precipChartConfig = {
        type: 'line',
        data: {
            datasets: [
                {
                    label: '% Chance Precip',
                    data: arrayToChartJSData(dataPoints.probabilityOfPrecipitation.time, dataPoints.probabilityOfPrecipitation.data),
                    fill: false,
                    cubicInterpolationMode: 'monotone',
                    borderColor:  colorScheme[2],
                    backgroundColor: colorScheme[2],
                    yAxisID: 'chance',
                    xAxisID: 'x',
                    interpolate: 'true,'
                },
            ]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                x: timeAxis,
                chance: {
                    scaleLabel: {
                        display: false,
                        labelString: '% Chance',
                    },
                    min: 0,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return  value + '%';
                        },
                        stepSize: 20,
                    },
                    type: 'linear',
                    axis: 'y',
                }
            },
            plugins: chartJSPlugins(syncIndex),
            title: {
                display: false,
                text: 'Precipitation',
            },
        },
    }
    
    const plotQPrec = isArrayNonzero(dataPoints.quantitativePrecipitation.data)
    const plotSnow = isArrayNonzero(dataPoints.snowfallAmount.data)
    
    if (plotQPrec) {
        const cumulativeSum = (sum => value => sum += value)(0);
        
        dataPoints.quantitativePrecipitation.data = dataPoints.quantitativePrecipitation.data.map(cumulativeSum)
        precipChartConfig.data.datasets.push({
            label: 'Cumulative Precip',
            data: arrayToChartJSData(dataPoints.quantitativePrecipitation.time, dataPoints.quantitativePrecipitation.data),
            fill: false,
            cubicInterpolationMode: 'monotone',
            borderColor:  colorScheme[3],
            backgroundColor: colorScheme[3],
            yAxisID: 'inches',
            interpolate: 'true',
        })
    }
    
    if (plotSnow) {
        const cumulativeSum = (sum => value => sum += value)(0);
        dataPoints.snowfallAmount.data = dataPoints.snowfallAmount.data.map(cumulativeSum)
        precipChartConfig.data.datasets.push({
            label: 'Cumulative Snow',
            data: arrayToChartJSData(dataPoints.snowfallAmount.time, dataPoints.snowfallAmount.data),
            fill: false,
            cubicInterpolationMode: 'monotone',
            borderColor:  colorScheme[4],
            backgroundColor: colorScheme[4],
            yAxisID: 'inches',
            interpolate: 'true',
        })
    }
    
    if (plotSnow || plotQPrec) {
        precipChartConfig.options.scales.inches = {
            scaleLabel: {
                display: true,
                labelString: 'Inches',
            },
            min: 0,
            suggestedMax: 0.25,
            type: 'linear',
            position: 'right',
            axis: 'y',
            grid: {
                display: false,
            },
        }
    }
    const precipChartJS = new Chart(canvas, precipChartConfig)
    return precipChartJS
}

function chartJsTimeAxis(timeRange) {
    return {
            type: 'time',
            min: timeRange[0].toJSDate(),
            max: timeRange[1].toJSDate(),
            time: {
                tooltipFormat: 'h:mm a',
                unit: 'hour',
                stepSize: 3,
                bounds: 'ticks',
            },
            scaleLabel: {
                display: false,
                labelString: 'Time',
            },
            grid: {
                display: false,
            },
            axis: 'x',
        }
}

function chartJSPlugins(groupNumber) {
    return {
        tooltip: {
                mode: 'interpolate',
                intersect: false,
                displayColors: true,
                callbacks:{
                    label:tooltipRoundValue0,
                    title: (items) => {
                        var now = items[0].raw.x.plus(items[0].element.x - items[0].parsed.x)
                        return now.toLocaleString(luxon.DateTime.TIME_SIMPLE)
                    },
                },
                animation: {duration: 10},
                axis:'x',
        },
        crosshair: {
            line: {
                color: 'rgb(0,0,0,0.4)',  // crosshair line color
                width: 1        // crosshair line width
            },
            sync: {
                enabled: true,            // enable trace line syncing with other charts
                group: groupNumber,                 // chart group
                suppressTooltips: false   // suppress tooltips when showing a synced tracer
            },
            zoom: {enabled: false},
        },
    }
}

function nowLine(chart, zoneData) {
    const now = luxon.DateTime.now().plus({minutes:zoneData.offset})
    const annotation = {
        annotations: {
            nowline: {
                type: 'line',
                xMin: now.toJSDate(),
                xMax: now.toJSDate(),
                borderColor: colorScheme[7],
                borderWidth: 2,
                xScaleID:'x',
                yScaleID:'temp',
                label: {
                    enabled:false,
                    position:'start',
                    content: 'Now',
                    font: {style: 'normal'},
                }
            }
        }
    }
    if (chart.options.plugins.hasOwnProperty("annotation")) {
        chart.options.plugins.annotation.annotations["nowline"] = annotation.annotations.nowline
    }
    else {
        chart.options.plugins.annotation = annotation
    }
    
}

function drawLatestObservation(stationsJson) {
    const station = stationsJson.features[0]
    console.log('station:', station)
    let elevation = station.properties.elevation.value
    if (station.properties.elevation.unitCode.includes('unit:m'))
        elevation = m2ft(elevation)
    const stationID = station.properties.stationIdentifier
    printError('Fetching data ' + totalFetched++ + '/5...')
    fetch_retry('https://api.weather.gov/stations/' + stationID + '/observations/latest?require_qc=true', fetchOptions)
    .then(response => {return response.json()})
    .then(obJson => {
        console.log('observation:', obJson)
        var currentTemp = obJson.properties.temperature.value
        const nowDiv = document.getElementById('conditions')
        nowDiv.style['text-align'] = 'center'
        const currentConditions = document.createElement("h4");
        currentConditions.style['margin-bottom'] = '0px'
        currentConditions.style['margin-top'] = '0px'
        let statusString = ''
        if (currentTemp === 0 || currentTemp) {
            if (obJson.properties.temperature.unitCode.includes('degC')) {
                currentTemp = Math.round(c2f(currentTemp))
                obJson.properties.temperature.unitCode = 'degF'
            }
            else {
                currentTemp = Math.round(currentTemp)
            }
            statusString += currentTemp.toString() + degreeSymbol + ' '
        }
        statusString += obJson.properties.textDescription
        const temp = document.createTextNode(statusString)
        currentConditions.appendChild(temp)
        nowDiv.appendChild(currentConditions)
    }).catch(e => {
        printError('Error 6 occurred.  Try another location or try later.  There might be a problem with api.weather.gov')
        console.log(e)
        throw new Error(e)
    })
}


function drawMap(lat, lon) {
    if (!mapDrawn) {
        mapDrawn = true
        map = L.map("map1",{doubleClickZoom:false, scrollWheelZoom:false, dragging:!L.Browser.mobile}).setView([lat,lon], 6);
        const osmAttribution ='Map data &copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
        L.tileLayer(
                "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                {attribution: osmAttribution, dragging:!L.Browser.mobile}
        ).addTo(map)
        
        mark = L.marker([lat,lon], {draggable:true, autoPan:true})
            .on('dragend', function(data) {
                map.panTo([data.target._latlng.lat, data.target._latlng.lng]);
                getWeather(data.target._latlng.lat, data.target._latlng.lng, true)
            })
        mark.addTo(map)
        
        buttonRadar()
        
        map.on('dblclick', doubleClick).on('contextmenu', doubleClick)
        map.options.dragging = !L.Browser.mobile
    }
    
    else {
        mark.setLatLng([lat, lon])
        map.panTo([lat, lon]);
    }
}

function doubleClick(e) {
    for (let i in e.sourceTarget._layers) {
        if (e.sourceTarget._layers[i]._latlng) {
            e.sourceTarget._layers[i].setLatLng([e.latlng.lat, e.latlng.lng])
            break
        }
    }
    e.sourceTarget.panTo([e.latlng.lat, e.latlng.lng])
    getWeather(e.latlng.lat, e.latlng.lng, true)
}
function removeMapLayers(){
    if (radar) {
        map.removeControl(radar)
        radar.removeLayers()
        radar = null
    }
    var thisLayer
    for (let key in map._layers) {
        thisLayer = map._layers[key]
        if ('_url' in thisLayer) {
            if (!thisLayer._url.includes('openstreetmap')) {
                thisLayer.remove()
            }
        }
    }
    clearID('legend')
}

function buttonRadar(){
    removeMapLayers()
    radar = L.control.radar().addTo(map)
}

function buttonTemperature(){
    
    const legend = {
        min: -50,
        data: [
        [[255,196,243], -25],
        [[249,171,234], -20],
        [[246,156,228], -15],
        [[238,135,217], -10],
        [[227,118,205], -8],
        [[227,118,218], -6],
        [[229,98,218], -4],
        [[228,90,223], -2],
        [[218,75,213], 0],
        [[206,58,201], 2],
        [[202,42,200], 4],
        [[197,11,195], 6],
        [[182,11,197], 8],
        [[164,11,197], 10],
        [[151,11,197], 12],
        [[138,11,197], 14],
        [[119,11,197], 16],
        [[107,11,197], 18],
        [[93,11,197], 20],
        [[73,11,197], 22],
        [[53,11,197], 24],
        [[11,11,197], 26],
        [[11,27,197], 28],
        [[11,49,195], 30],
        [[11,93,195], 32],
        [[11,111,195], 34],
        [[11,130,195], 36],
        [[11,139,209], 38],
        [[11,165,216], 40],
        [[0,189,231], 42],
        [[0,198,243], 44],
        [[0,206,236], 46],
        [[0,218,205], 48],
        [[0,220,177], 50],
        [[0,218,145], 52],
        [[0,212,109], 54],
        [[0,206,77], 56],
        [[0,200,49], 58],
        [[11,192,11], 60],
        [[46,196,0], 62],
        [[77,202,0], 64],
        [[119,208,0], 66],
        [[136,200,0], 68],
        [[174,216,0], 70],
        [[207,222,11], 72],
        [[220,225,11], 74],
        [[233,229,0], 76],
        [[241,236,0], 78],
        [[252,248,0], 80],
        [[255,238,0], 82],
        [[255,227,0], 84],
        [[255,215,0], 86],
        [[255,197,0], 88],
        [[255,185,0], 90],
        [[254,167,0], 92],
        [[252,141,0], 94],
        [[249,100,0], 96],
        [[243,71,0], 98],
        [[232,53,0], 100],
        [[217,42,0], 102],
        [[200,27,0], 104],
        [[187,20,0], 106],
        [[178,11,0], 108],
        [[167,11,0], 110],
        [[150,11,0], 115],
        [[115,11,0], 120],
        [[92,11.3,0], 125],
        [[73,11,0], 160],
    ]}
    
    legend.labels = [legend.min + degreeSymbol]
    for (let i = 0; i < legend.data.length; i++)
        legend.labels.push(legend.data[i][1] + degreeSymbol)
    
    removeMapLayers()
    L.tileLayer.wms('https://new.nowcoast.noaa.gov/arcgis/services/nowcoast/forecast_meteoceanhydro_sfc_ndfd_time/MapServer/WmsServer?', {
        layers: '25',
        format: 'image/png',
        transparent: true,
        opacity: 0.75,
        version: '1.3.0',
    }).addTo(map);
    drawLegend(legend)
}

function drawLegend(legendObj) {
    const w = Math.min(550, map._size.x)
    const h = 50
    
    const barw = w - 30
    const barh = 30
    const marginLeft = 0.5 * (w - barw)
    
    const n = legendObj.data.length
    const wBlock = barw / n
    
    const legendDiv = document.getElementById('legend')
    legendDiv.style.height = h
    legendDiv.style.width = w
    
    const legendSVG = d3.select(legendDiv)
        .append('svg')
        .attr('width', w)
        .attr('height', h)
        .attr('x', 0)
        .attr('y', 0)
        
    legendSVG.selectAll('rect')
        .data(legendObj.data)
        .enter()
        .append('rect')
        .attr('width', wBlock)
        .attr('x', (d,i) => {return marginLeft + wBlock * i})
        .attr('y', 0)
        .attr('height', barh)
        .attr('fill', d => {return 'rgb(' +  d[0][0] + ', ' + d[0][1] + ', ' + d[0][2] +  ')'})
        .attr('fill-opacity', 0.75)
    
    const wBtwLabels = 30
    legendSVG.selectAll('text')
        .data(legendObj.labels)
        .enter()
        .append('text')
        .attr('x', (d,i) => {return marginLeft + wBlock * (i)})
        .attr('y', barh)
        .attr("font-size", 12)
        .attr("text-anchor", "middle")
        .attr('dominant-baseline', 'hanging')
        .text((d,i) => {
            if (i % (Math.ceil(wBtwLabels / wBlock)) == 0)
                return d
            else
                return ''
        })
}

function inches2ftin(num) {
    const feet = Math.floor(num / 12)
    const inch = num - (12 * feet)
    if (feet > 0)
        return feet + '\' ' + inch + '\"'
    else
        return inch + '\"'
}

function buttonSnowDepth(){
    
    const legend = {
        'min': 0,
        'data':[
        [[255,255,255],1],
        [[171,193,191],2],
        [[103,193,196],4],
        [[100,169,203],10],
        [[79,121,200],20],
        [[61,64,194],39],
        [[87,33,195],59],
        [[125,0,187],98],
        [[180,0,177],197],
        [[169,20,119],295],
        [[153,42,79],394],
//         [[139,69,69],787],
    ]}
    legend.labels = [inches2ftin(legend.min)]
    for (let i = 0; i < legend.data.length; i++)
        legend.labels.push(inches2ftin(legend.data[i][1]))
    
    removeMapLayers()
    L.tileLayer.wms('https://idpgis.ncep.noaa.gov/arcgis/services/NWS_Observations/NOHRSC_Snow_Analysis/MapServer/WmsServer?', {
        layers: '5',
        format: 'image/png8',
        transparent: true,
        opacity: 0.75,
    }).addTo(map);
    drawLegend(legend) 
}


function getSunriseSunset(lat, lon, date, zoneData){
    const thisJD = getJD(date.year, date.month, date.day)
    const sunriseObject = calcSunriseSet(true, thisJD , lat, lon, date.offset / 60)
    const sunsetObject = calcSunriseSet(false, thisJD, lat, lon, date.offset / 60)
    const sunrise = date.set({hour:0,minute:0,second:0}).plus({minutes:sunriseObject.timelocal}).plus({minutes:zoneData.offset})
    const sunset = date.set({hour:0,minute:0,second:0}).plus({minutes:sunsetObject.timelocal}).plus({minutes:zoneData.offset})
    return {sunrise:sunrise,sunset:sunset}
}

//  Get weather data
const degreeSymbol = String.fromCharCode(176)
function getWeather(lat, lon, reverseGeo, updateURL=true) {
    
    totalFetched = 1

    if (reverseGeo) {
        reverseGeocode(lat,lon)
    }
    
    if (updateURL) {
        const newURL = new URL(window.location.href.split('?')[0])
        newURL.searchParams.append('lat',lat.toFixed(5))
        newURL.searchParams.append('lon',lon.toFixed(5))
        window.history.pushState({}, '', newURL)
    }
    
    // Timezone calc
    const thisTimeZone = tzlookup(lat,lon)
    const localTime = luxon.DateTime.local().setZone(thisTimeZone)
    const thisOffset = localTime.offset - luxon.DateTime.local().offset    
    const zoneData = {zone:thisTimeZone, offset:thisOffset}
    
    clearID('days')
    clearID('summary')
    clearID('conditions')
    
    //  Create map
    drawMap(lat, lon)
    printError('Fetching data ' + totalFetched++ + '/5...')
    
    return fetch_retry('https://api.weather.gov/points/' + lat + ',' + lon, fetchOptions)
    .then(response => {return response.json()})
    .then(pointsJson => {
        const fetch_points = fetch_retry(pointsJson.properties.observationStations, fetchOptions)
        const fetch_forecast = fetch_retry(pointsJson.properties.forecast, fetchOptions)
        const fetch_grid = fetch_retry(pointsJson.properties.forecastGridData, fetchOptions)
        printError('Fetching data ' + totalFetched++ + '/5...')
        return fetch_points
        .then(response => {return response.json()})
        .then(stationsJson => {
            drawLatestObservation(stationsJson)
            
            const todayMidnight = luxon.DateTime.local().plus({minutes:zoneData.offset}).set({hour:24,minute:0,second:0,millisecond:0})
            const lastMidnight = todayMidnight.minus({days:1})
            
            printError('Fetching data ' + totalFetched++ + '/5...')
            return fetch_forecast
            .then(response => {return response.json()})
            .then(forecastJson => {
                console.log("daydata:", forecastJson)
                const dayProps = forecastJson.properties
                
                //  Print text summary of present forecast
                const nowDiv2 = document.createElement("div")
                nowDiv2.style['text-align'] = 'left'
                nowDiv2.style.display = 'flex'
                const middleColumn = document.createElement("div");
                middleColumn.style.width='100%'
                const p1 = document.createElement("p");
                const bold = document.createElement("b");
                const prefix = document.createTextNode(dayProps.periods[0].name + ': ')
                const summary = document.createTextNode(dayProps.periods[0].detailedForecast);
                bold.appendChild(prefix)
                p1.appendChild(bold)
                p1.appendChild(summary)
                middleColumn.appendChild(p1)
                nowDiv2.appendChild(middleColumn)
                document.getElementById('summary').appendChild(nowDiv2)
                const dayPeriods = dayProps.periods
        
                //  Create detailed forecasts
                printError('Fetching data ' + totalFetched++ + '/5...')
                
                return fetch_grid
                .then(response => {return response.json()})
                .then(gridJson => {
                    
                    console.log('grid:', gridJson)
                    const gridProps = gridJson.properties
                    
                    // Get final midnight time in grid data
                    const lastGridMidnightAndDuration = gridProps.temperature.values.slice(-1)[0].validTime.split('/')
                    const lastGridMidnight = luxon.DateTime.fromISO(lastGridMidnightAndDuration[0]).plus({minutes:zoneData.offset}).plus(luxon.Duration.fromISO(lastGridMidnightAndDuration[1])).startOf('day')
                    const fields = ['temperature', 'apparentTemperature', 'probabilityOfPrecipitation', 'quantitativePrecipitation', 'snowfallAmount', 'weather','skyCover']
                    const numDaysAfterToday = luxon.Interval.fromDateTimes(todayMidnight, lastGridMidnight).length('days')
                    const plotData = generateDataInDateRange(gridProps, ['temperature'], lastMidnight, lastGridMidnight, zoneData)
                    const xExtent = [Math.min(...plotData.temperature.data), Math.max(...plotData.temperature.data)]

                    var currentDay, currentDayIdx = 0
                    for (let i = 0; i <= numDaysAfterToday; i++) {
                        const thisDate = lastMidnight.plus({days:i})
                        
                        // Make button div
                        const div = document.createElement('button');
                        div.style.outline = 'none'
                        div.style.cursor = 'Pointer'
                        div.style.border='none'
                        div.style.width = "100%";
                        div.style.display = "flex";
                        div.style['margin'] = '0px'
                        div.style['padding'] = '0px'
                        const buttonElem = document.getElementById("days").appendChild(div)
                        buttonElem.classList.add('collapsible')
                        buttonElem.onclick =  function() {
                            this.classList.toggle("active");
                            const content = this.nextElementSibling
                            if (content.style.maxHeight){
                                content.style.maxHeight = null;
                            } else {
                                if (!content.classList.contains('generated')) {
                                    content.classList.add("generated")
                                }
                                content.style.maxHeight = content.scrollHeight + "px";
                            }
                        }
                        
                        const content = document.createElement('div')
                        content.classList.add('content')
                        content.classList.add('generated')
                        document.getElementById("days").appendChild(content)
                        
                        // find corresponding day data
                        for (let d = currentDayIdx; d < dayPeriods.length; d++) {
                            if (dayPeriods[d].startTime.split('T')[0].split('-').slice(-1)[0] == thisDate.day) {
                                currentDay = dayPeriods[d]
                                currentDayIdx = d
                                break
                            }
                        }

                        const timeRange = [thisDate, thisDate.plus({days:1})]
                        const timeAxis = chartJsTimeAxis(timeRange)

                        const todayData = generateDataInDateRange(gridProps, fields, timeRange[0], timeRange[1], zoneData)

                        //  Condition div
                        // Check if any intensity not null
                        const div1 = document.createElement('div')
                        div1.classList.add('conditionParent')
                        content.appendChild(div1)
                        const div11 = document.createElement('canvas')
                        div1.appendChild(div11)
                        const conditionChart = conditionPlotter(div11, timeAxis, todayData, i, lat, lon, timeRange, zoneData)
                        
                        // temperature plot
                        const div2 = document.createElement('div')
                        div2.classList.add('canvasParent')
                        content.appendChild(div2)
                        const div21 = document.createElement('canvas')
                        div2.appendChild(div21)
                        const tempChartJS = temperaturePlotter(div21, timeAxis, todayData, i)
                        
                        // precipitation plot
                        const div3 = document.createElement('div')
                        div3.classList.add('canvasParent')
                        content.appendChild(div3)
                        const div31 = document.createElement('canvas')
                        div3.appendChild(div31)
                        const thisPrecipChart = precipPlotter(div31, timeAxis, todayData, i)
                        
                        nowLine(conditionChart, zoneData)
                        nowLine(tempChartJS, zoneData)
                        nowLine(thisPrecipChart, zoneData)

                        alignTwoCharts(tempChartJS, thisPrecipChart)
                        alignChartAtoB(conditionChart, tempChartJS)

                        //  D3 bar
                        const thisTempExtent = [Math.min(...todayData.temperature.data), Math.max(...todayData.temperature.data)]
                        const iconSize = 40
                        const iconSpace = 10
                        const svgBarBoxH = 50
                        const svgBarH = 20
                        const svgBarTextWidth = 50
                        const svgBarLabelPadding = 45
                        const svgBarDegreeLabelPadding = 4
                        const plusPadding = 14
                        const xRange = [svgBarTextWidth + svgBarLabelPadding, buttonElem.clientWidth - svgBarLabelPadding - plusPadding - iconSize - iconSpace]
                        const barXScale = d3.scaleLinear().range(xRange).domain(xExtent)
                        const weatherIcon = document.createElement("img")
                        weatherIcon.src = currentDay.icon
                        weatherIcon.alt = currentDay.shortForecast
                        weatherIcon.title = currentDay.shortForecast
                        weatherIcon.height = iconSize
                        weatherIcon.style['margin-right'] = iconSpace + 'px'
                        if (weatherIcon.src != null)
                            buttonElem.appendChild(weatherIcon)
                        const svgBar = d3.select(buttonElem)
                            .append('svg')
                            .attr("width", '100%')
                            .attr("height", svgBarBoxH)
                        svgBar.append('text')
                            .attr('x', 0)
                            .attr('y', 0.5 * svgBarBoxH)
                            .attr('dominant-baseline', 'middle')
                            .attr('text-anchor', 'start')
                            .style('font-weight', 'bold')
                            .style('font-size', '15px')
                            .text(i == 0 ? 'Today' : thisDate.weekdayShort)
                        const xScaleMin = barXScale(thisTempExtent[0])
                        const xScaleMax = barXScale(thisTempExtent[1])
                        //  Create rectangle
                        svgBar.append('rect')
                            .attr('x', xScaleMin)
                            .attr('y', 0.5 * (svgBarBoxH - svgBarH))
                            .attr('width', xScaleMax - xScaleMin)
                            .attr('height', svgBarH)
                            .attr('fill', '#737373')
                            
                        //  Append semi-circle on each side
                        const circleR = 0.5 * svgBarH
                        svgBar.append('circle')
                            .attr('cx', xScaleMin)
                            .attr('cy', 0.5 * svgBarBoxH)
                            .attr('r', circleR)
                            .attr('fill', '#737373')
                        svgBar.append('circle')
                            .attr('cx', xScaleMax)
                            .attr('cy', 0.5 * svgBarBoxH)
                            .attr('r', circleR)
                            .attr('fill', '#737373')
                            
                        //  Text on each side
                        svgBar.append('text')
                            .attr('x', xScaleMin - svgBarDegreeLabelPadding - circleR)
                            .attr('y', 0.5 * svgBarBoxH)
                            .attr('text-anchor', 'end')
                            .attr('dominant-baseline', 'middle')
                            .text(Math.round(thisTempExtent[0]).toString() + degreeSymbol)
                        svgBar.append('text')
                            .attr('x', xScaleMax + svgBarDegreeLabelPadding + circleR)
                            .attr('y', 0.5 * svgBarBoxH)
                            .attr('text-anchor', 'start')
                            .attr('dominant-baseline', 'middle')
                            .text(Math.round(thisTempExtent[1]).toString() + degreeSymbol)
                    }
                })
            })
        })
    })
    .then(() => {
        if (d3.select('#errors').text().startsWith('Fetching'))
            d3.select('#errors').text('')
    })
//     .catch(e => {
//         printError('Error occurred.  Try refreshing.  There might be a problem with api.weather.gov')
//         throw new Error(e)
//     })
}

addressAutocomplete(document.getElementById("autocomplete-container"), (data) => {
    if (data)
        geocodeArcgis(data.magic)
}, {
    placeholder: "Enter an address here",
});

function defaultAction() {
    return fetch_retry('https://ipapi.co/json/')
    .then(response => {return response.json()})
    .catch(e => {
        console.log('IP Location Error: ', e)
        document.getElementById('textinput').value = 'Somerville, MA'
        geocode()
    })
    .then(
        json => {
            console.log('Successful IP Location: ' + json.ip + ' -> (' + json.latitude + ', ' + json.longitude + ')' )
            return getWeather(json.latitude, json.longitude, true)
        })
}

var totalFetched = 1
var map, radar
const paramString = new URLSearchParams(window.location.search)
if (paramString.has('lat') && paramString.has('lon')) {
    const lat = parseFloat(paramString.get("lat"))
    const lon = parseFloat(paramString.get("lon"))
    
    if (!isNaN(lon) && !isNaN(lat)) {
        if (pointInsideUSA([lat,lon]))
            getWeather(lat, lon, true, false)
        else
            defaultAction()
    }
    else
        defaultAction()
}
else
    defaultAction()
