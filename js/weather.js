'use strict'

const fetchOptions = {
    method:'GET',
}

//  Create text search box
const loc = document.getElementById("textinput")
var mapDrawn = false
var mark

//  Allow pressing enter to submit
loc.addEventListener("keyup", function(event) {
    if (event.keyCode === 13) {
        toggleButtonDisable()
        event.preventDefault()
        geocode().then(() => {toggleButtonDisable()})
    }
})

function precipPlotter(canvas, timeAxis, dataPoints, syncIndex){
    const precipChartConfig = {
        type: 'line',
        data: {
            datasets: [
                {
                    label: '% Chance',
                    data: arrayToChartJSData(dataPoints.probabilityOfPrecipitation.time, dataPoints.probabilityOfPrecipitation.data),
                    fill: false,
                    cubicInterpolationMode: 'monotone',
                    borderColor: '#000',
                    backgroundColor: '#000',
                    yAxisID: 'chance',
                },
            ]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                xAxes: timeAxis,
                yAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: '% Chance',
                    },
                    ticks: {
                        callback: function(value) {
                            return  value + '%';
                        },
                        min: 0,
                        max: 100,
                        stepSize: 20,
                    },
                    type: 'linear',
                    id: 'chance',
                    position: 'left',
                }]
            },
            tooltips: {
                mode: 'nearest',
                axis: 'x',
                position: 'nearest',
                intersect: false,
                displayColors: false,
                callbacks:{label:tooltipRoundValue}
            },
            hover : {
                animationDuration: 10,
            },
            legend: {
                display: true,
            },
            plugins: chartJSPlugins(syncIndex),
            title: {
                display: true,
                text: 'Precipitation',
            }
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
            borderColor: '#1F77B4',
            backgroundColor: '#1F77B4',
            yAxisID: 'inches',
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
            borderColor: '#b971e2',
            backgroundColor: '#b971e2',
            yAxisID: 'inches',
        })
    }
    
    if (plotSnow || plotQPrec) {
        precipChartConfig.options.scales.yAxes.push({
            scaleLabel: {
                display: true,
                labelString: 'Inches',
            },
            ticks: {
                min: 0,
                suggestedMax: 0.25
            },
            type: 'linear',
            id: 'inches',
            position: 'right',
            gridLines: {
                display: false,
            },
        })
    }
    const precipChartJS = new Chart(canvas, precipChartConfig)
    return precipChartJS
}

function chartJsTimeAxis(timeRange) {
    
    return [{
            type: 'time',
            ticks: {
                min: timeRange[0],
                max: timeRange[1],
            },
            time: {
                tooltipFormat: 'h:mm a',
                unit: 'hour',
                stepSize: 3,
                bounds: 'ticks',
            },
            scaleLabel: {
                display: true,
                labelString: 'Time',
            },
            gridLines: {
                display: false,
            }
        }]
}

function chartJSPlugins(groupNumber) {
    return {
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


function todayPlots(gridProps, todayObservationsJson, stationID, plotdiv, todayMidnight, lastMidnight, firstTime, zoneData) {
    const todayFields = ['temperature']
    
    var minTemp
    var maxTemp
    var todayIcon
//     todayObservationsJson.features = todayObservationsJson.features.slice(1,)
    const lenObs = todayObservationsJson.features.length
    var plotObservations = lenObs  > 0
    let obsData = {'temperature':[], 'time':[]}
    let todayForecast
    const mostRecentObsTimeMinus1hr = luxon.DateTime.fromISO(todayObservationsJson.features[0].properties.timestamp).minus({hours:1}).setZone(zoneData.zone)
    if (plotObservations) {
        todayIcon = todayObservationsJson.features[0].properties.icon
        for (let i = 0; i < lenObs; i++) {
            if (todayObservationsJson.features[lenObs - 1 - i].properties.temperature.value != null) {
                if (todayObservationsJson.features[lenObs - 1 - i].properties.temperature.unitCode.includes('degC')) {
                    todayObservationsJson.features[lenObs - 1 - i].properties.temperature.value = c2f(todayObservationsJson.features[lenObs - 1 - i].properties.temperature.value)
                    todayObservationsJson.features[lenObs - 1 - i].properties.temperature.unitCode = 'degF'
                }
                obsData.temperature.push(todayObservationsJson.features[lenObs - 1 - i].properties.temperature.value)
                obsData.time.push(luxon.DateTime.fromISO(todayObservationsJson.features[lenObs - 1 - i].properties.timestamp).setZone(zoneData.zone).plus({minutes:zoneData.offset}))
            }
        }
        todayForecast = generateDataInDateRange(gridProps, todayFields, mostRecentObsTimeMinus1hr, todayMidnight, zoneData)
    }
    else {
        todayForecast = generateDataInDateRange(gridProps, todayFields, firstTime, todayMidnight, zoneData)
    }
    
    // Find minimum and maximum temperature
    minTemp = Math.min(...todayForecast['temperature'].data)
    maxTemp = Math.max(...todayForecast['temperature'].data)
    if (plotObservations) {
        const obsMin = Math.min(...obsData.temperature)
        const obsMax = Math.max(...obsData.temperature)
        minTemp = (obsMin < minTemp) ? obsMin : minTemp
        maxTemp = (obsMax > maxTemp) ? obsMax : maxTemp
    }
    
    const todayDiv = document.createElement('div')
    todayDiv.classList.add('canvasParent')
    const todayCanvas1 = document.createElement('canvas')
    todayDiv.appendChild(todayCanvas1)
    const elem = plotdiv.appendChild(todayDiv)
    const timeRange = [lastMidnight.plus({minutes:zoneData.offset}), todayMidnight.plus({minutes:zoneData.offset})]
        
    const timeAxis = chartJsTimeAxis(timeRange)
    const tempChartConfig = {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Forecast',
                    data: arrayToChartJSData(todayForecast['temperature'].time, todayForecast['temperature'].data),
                    fill: false,
                    cubicInterpolationMode: 'monotone',
                    borderColor: '#000',
                    backgroundColor: '#000',
                },
            ]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                xAxes: timeAxis,
                yAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: 'Temperature ' + degreeSymbol + 'F',
                    },
                    ticks: {
                        callback: function(value) {
                            return  value + degreeSymbol;
                        },
                    },
                    type: 'linear',
                }]
            },
            tooltips: {
                mode: 'nearest',
                axis: 'x',
                position: 'nearest',
                intersect: false,
                displayColors: false,
                callbacks:{label:tooltipRoundValue}
            },
            hover : {
                animationDuration: 10,
            },
            legend: {
                display: false,
            },
            plugins: chartJSPlugins(0),
        },
    }
    if (plotObservations) {
        tempChartConfig.data.datasets.push({
            label: 'Observed',
            data: arrayToChartJSData(obsData.time, obsData.temperature),
            fill: false,
            cubicInterpolationMode: 'monotone',
            borderColor: '#888',
            backgroundColor: '#888',
        })
        tempChartConfig.options.legend.display = true
    }
    const tempChartJS = new Chart(todayCanvas1, tempChartConfig)
        
    // Today Precipitation plot
    const todayDiv2 = document.createElement('div')
    todayDiv2.classList.add('canvasParent')
    const todayCanvas2 = document.createElement('canvas')
    todayDiv2.appendChild(todayCanvas2)
    const elem2 = plotdiv.appendChild(todayDiv2)
    const todayPrecipForecast = generateDataInDateRange(gridProps, ['quantitativePrecipitation', 'probabilityOfPrecipitation', 'snowfallAmount'], firstTime, todayMidnight, zoneData)

    const todayPrecipChart = precipPlotter(todayCanvas2, timeAxis, todayPrecipForecast, 0)
    
    alignTwoCharts(tempChartJS, todayPrecipChart)
    return {'minTemp':minTemp, 'maxTemp':maxTemp, 'icon':todayIcon}
}

async function drawLatestObservation(stationsJson) {
    const station = stationsJson.features[0]
    
    console.log('station:', station)
    let elevation = station.properties.elevation.value
    if (station.properties.elevation.unitCode.includes('unit:m'))
        elevation = m2ft(elevation)
    const stationID = station.properties.stationIdentifier
    
    const response_ob = await fetch_retry('https://api.weather.gov/stations/' + stationID + '/observations/latest?require_qc=true', fetchOptions, 10)
    const obJson =  await (async () => {return await response_ob.json()})()
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
    return stationID
}


async function drawMap(lat, lon) {
    
    if (!mapDrawn) {
        mapDrawn = true
        map = L.map("map1",{doubleClickZoom:false, scrollWheelZoom:false, dragging:!L.Browser.mobile}).setView([lat,lon], 5);
        const osmAttribution ='Map data &copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors';
        const leafletRadarAttribution ='<a href="https://github.com/rwev/leaflet-radar">Radar</a>';
        L.tileLayer(
                "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                {attribution: [osmAttribution, leafletRadarAttribution].join(" | "), dragging:!L.Browser.mobile}
        ).addTo(map);
        mark = L.marker([lat,lon])
        mark.addTo(map);
        const radar = L.control.radar().addTo(map);
        map.on('dblclick', function(e) {
        getWeather(e.latlng.lat, e.latlng.lng, true)
        }).on('contextmenu', function(e) {
            getWeather(e.latlng.lat, e.latlng.lng, true)
        })
        map.options.dragging = !L.Browser.mobile
    }
    else {
        map.removeLayer(mark)
        map.panTo([lat,lon]);
        mark = L.marker([lat,lon]).addTo(map);
    }
}

//  Get weather data
const degreeSymbol = String.fromCharCode(176)
async function getWeather(lat, lon, reverseGeo=false) {

    if (reverseGeo) {
        reverseGeocode(lat,lon)
    }
    
    const thisTimeZone = tzlookup(lat,lon)
    const localTime = luxon.DateTime.local().setZone(thisTimeZone)
    const thisOffset = localTime.offset - luxon.DateTime.local().offset
    const zoneData = {zone:thisTimeZone, offset:thisOffset}

    clearID('days')
    clearID('today')
    clearID('errors')
    clearID('summary')
    clearID('conditions')
    
    
    //  Create map
    drawMap(lat, lon)
    
    const fetchPoints = await fetch_retry('https://api.weather.gov/points/' + lat + ',' + lon, fetchOptions, 10)
    const pointsJson = await (() => {return fetchPoints.json()})()
    if (pointsJson == null || pointsJson.length == 0) {
            printError('Error: Weather at this location is not available from Weather.gov.')
    }
    else {
        clearID('conditions')
        const fetch_points = fetch_retry(pointsJson.properties.observationStations, fetchOptions, 10)
        const fetch_forecast = fetch_retry(pointsJson.properties.forecast, fetchOptions, 10)
        const [response_points] = await Promise.all([fetch_points]);
        const [stationsJson] = await Promise.all([(() => {return response_points.json()})()]);
        const fetch_grid = fetch_retry(pointsJson.properties.forecastGridData, fetchOptions, 10)
        drawLatestObservation(stationsJson)
        const stationID = stationsJson.features[0].properties.stationIdentifier
        const todayMidnight = luxon.DateTime.local().setZone(thisTimeZone).set({hour:24,minute:0,second:0,millisecond:0})
        let lastMidnight = todayMidnight.minus({days:1})
        const fetch_obs = fetch_retry('https://api.weather.gov/stations/' + stationID + '/observations?start=' + encodeURIComponent(lastMidnight.toISO({suppressMilliseconds:true})), fetchOptions, 5)
        
        //  Create day by day summary
        const [respose_forecast] = await Promise.all([fetch_forecast]);
        const [forecastJson] = await Promise.all([(() => {return respose_forecast.json()})()]);
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
        
        var currentDay, todayData, xExtent
        
        //  Create detailed forecasts
        const [reponse_grid] = await Promise.all([fetch_grid]);
        const gridJson =  await (async () => {return await reponse_grid.json()})()
        if (gridJson == null || gridJson.length == 0 || gridJson.properties == undefined) {
            printError('Error: Weather at this location is not available from Weather.gov.')
        }
        else {
            console.log('grid:', gridJson)
            const gridProps = gridJson.properties
            const firstTime = luxon.DateTime.fromISO(gridProps.temperature.values[0].validTime.split('/')[0]).setZone(thisTimeZone)
            
            // Get final midnight time in grid data
            const lastGridMidnightAndDuration = gridProps.temperature.values.slice(-1)[0].validTime.split('/')
            const lastGridMidnight = luxon.DateTime.fromISO(lastGridMidnightAndDuration[0]).setZone(thisTimeZone).plus(luxon.Duration.fromISO(lastGridMidnightAndDuration[1])).startOf('day')
            const fields = ['temperature', 'apparentTemperature', 'probabilityOfPrecipitation', 'quantitativePrecipitation', 'snowfallAmount']
            const plotData = generateDataInDateRange(gridProps, fields, todayMidnight, lastGridMidnight, zoneData)
            const numDaysAfterToday = luxon.Interval.fromDateTimes(todayMidnight, lastGridMidnight).length('days')
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
                for (let d = 0; d < dayPeriods.length; d++) {
                    if (dayPeriods[d].startTime.split('T')[0].split('-').slice(-1)[0] == thisDate.day) {
                        currentDay = dayPeriods[d]
                        break
                    }
                }

                // Today is i == 0
                var tempData = {}
                if (i == 0) {
                    const [response_obs] = await Promise.all([fetch_obs]);
                    const todayObservationsJson =  await (async () => {return await response_obs.json()})()
                    
                    console.log("todays observations:", todayObservationsJson)
                    todayData = todayPlots(gridProps, todayObservationsJson, stationID, content, todayMidnight, lastMidnight, firstTime, zoneData)
                }
                else {
                    Object.keys(plotData).forEach(function (field, index) {
                        tempData[field] = {'data':[],'time':[]}
                        tempData[field].data = plotData[field].data.slice((i-1)*24, i*24+1)
                        tempData[field].time = plotData[field].time.slice((i-1)*24, i*24+1)
                    }) 
                    
                    //  add day description (not working yet)
//                     const div1 = document.createElement('div')
//                     const text = document.createTextNode(currentDay.detailedForecast)
//                     div1.appendChild(text)
//                     div1.style.width = "90%"
//                     div1.style.display = "inline-block"
//                     content.appendChild(div1)
                    
                    //  Elem = div for temperature plot
                    const div2 = document.createElement('div')
                    div2.classList.add('canvasParent')
                    content.appendChild(div2)
                    const div21 = document.createElement('canvas')
                    div2.appendChild(div21)
                    
                    // Determine if apparent temp is different from actual
                    const timeRange = [thisDate.plus({minutes:zoneData.offset}), thisDate.plus({days:1}).plus({minutes:zoneData.offset})]
                    const timeAxis = chartJsTimeAxis(timeRange)
                    const tempChartConfig = {
                        type: 'line',
                        data: {
                            datasets: [
                                {
                                    label: 'Temperature',
                                    data: arrayToChartJSData(tempData['temperature'].time, tempData['temperature'].data),
                                    fill: false,
                                    cubicInterpolationMode: 'monotone',
                                    borderColor: '#000',
                                    backgroundColor: '#000',
                                },
                                
                            ]
                        },
                        options: {
                            maintainAspectRatio: false,
                            scales: {
                                xAxes: timeAxis,
                                yAxes: [{
                                    scaleLabel: {
                                        display: true,
                                        labelString: 'Temperature ' + degreeSymbol + 'F',
                                    },
                                    ticks: {
                                        callback: function(value) {
                                            return  value + degreeSymbol;
                                        },
                                    },
                                    type: 'linear',
                                }]
                            },
                            tooltips: {
                                mode: 'nearest',
                                axis: 'x',
                                position: 'nearest',
                                intersect: false,
                                displayColors: true,
                            },
                            hover : {
                                animationDuration: 10,
                            },
                            legend: {
                                display: false,
                            },
                            plugins: chartJSPlugins(i+1),
                        },
                    }
                    
                    if (isArrayNonzero(tempData.apparentTemperature.data)) {
                        tempChartConfig.options.legend.display = true
                        tempChartConfig.data.datasets.push({
                            label: 'Feels Like',
                            data: arrayToChartJSData(tempData['apparentTemperature'].time, tempData['apparentTemperature'].data),
                            fill: false,
                            cubicInterpolationMode: 'monotone',
                            borderColor: '#888',
                            backgroundColor: '#888',
                        })
                    }
                    const tempChartJS = new Chart(div21, tempChartConfig)
                    tempChartJS.canvas.parentNode.style.height = '250px';
                        
                    //  Elem2 = div for precipitation plot
                    const div3 = document.createElement('div')
                    div3.classList.add('canvasParent')
                    content.appendChild(div3)
                    const div31 = document.createElement('canvas')
                    const elem2 = div3.appendChild(div31)

                    //  Precipitation plot
                    const thisPrecipChart = precipPlotter(div31, timeAxis, tempData, i+1)
                    alignTwoCharts(tempChartJS, thisPrecipChart)
                }
                
                //  D3 bar
                if (i == 0) {
                    xExtent = [Math.min(...plotData.temperature.data), Math.max(...plotData.temperature.data)]
                    xExtent = [Math.min(xExtent[0], todayData.minTemp), Math.max(xExtent[1], todayData.maxTemp)]
                }
                const thisTempExtent = i == 0 ? [todayData.minTemp, todayData.maxTemp] : [Math.min(...tempData.temperature.data), Math.max(...tempData.temperature.data)]
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
                const dateParser = d3.timeParse('%Y-%m-%d')
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
        }
       
    }
}


geocode()
