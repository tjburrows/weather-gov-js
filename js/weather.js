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

function todayPlots(gridProps, todayObservationsJson, stationID, plotdiv, todayMidnight, lastMidnight, firstTime, zoneData) {
    const todayFields = ['temperature']
    
    var minTemp
    var maxTemp
    var todayIcon
    todayObservationsJson.features = todayObservationsJson.features.slice(1,)
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
                obsData.time.push(luxon.DateTime.fromISO(todayObservationsJson.features[lenObs - 1 - i].properties.timestamp).setZone(zoneData.zone).plus({minutes:zoneData.offset}).toJSDate())
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
    todayDiv.style.width = "100%"
    todayDiv.style.display = "inline-block"
    const elem = plotdiv.appendChild(todayDiv)
    const timeRange = [lastMidnight.plus({minutes:zoneData.offset}).toJSDate(), todayMidnight.plus({minutes:zoneData.offset}).toJSDate()]
    //  Temperature line plot
    const layoutToday = {
        height: 200,
        paper_bgcolor:'rgba(0,0,0,0)',
        plot_bgcolor:'rgba(0,0,0,0)',
        title: 'Temperature (' + degreeSymbol +  'F)',
        xaxis: {
            type:'date',
            tickformat: '%-I %p',
            fixedrange: true,
            showgrid:false,
            range: timeRange,
        },
        yaxis: {
            fixedrange: true,
            showgrid: false,
            gridcolor:'rgba(0,0,0,0.25)',
        },
        legend: {
            x: 1,
            y: 1,
            xanchor: 'right',
            yanchor: 'top',
            traceorder: 'reversed',
        },
        margin: {b:30, t:40,l:40,r:30},
    }
    
    const configToday = {
        responsive: true,
        displayModeBar: false,
    }

    const tracesToday = Array(2)
    tracesToday[1] = {
        x: todayForecast['temperature'].time,
        y: todayForecast['temperature'].data,
        mode:'lines',
        type:'scatter',
        line: {
            color: '#000',
            width: 3,
        },
        name: 'Forecast',
    }
    tracesToday[0] = {
        x: obsData.time,
        y: obsData.temperature,
        mode:'lines',
        type:'scatter',
        line: {
            color: '#888',
            width: 3,
        },
        name: 'Observed',
    }
    
    if (!plotObservations)
        layoutToday.showlegend = false
    if (plotObservations)
        Plotly.newPlot(elem, tracesToday, layoutToday, configToday)
    else
        Plotly.newPlot(elem, [tracesToday[1]], layoutToday, configToday)
        
    // Today Precipitation plot
    const todayDiv2 = document.createElement('div')
    todayDiv2.style.width = "100%"
    todayDiv2.style.display = "inline-block"
    const elem2 = plotdiv.appendChild(todayDiv2)
    var todayPrecipForecast
    if (plotObservations)
        todayPrecipForecast = generateDataInDateRange(gridProps, ['quantitativePrecipitation', 'probabilityOfPrecipitation'], mostRecentObsTimeMinus1hr, todayMidnight, zoneData)
    else
        todayPrecipForecast = generateDataInDateRange(gridProps, ['quantitativePrecipitation', 'probabilityOfPrecipitation'], firstTime, todayMidnight, zoneData)

    //  Determine whether to show inches bar chart
    //  Sum over all quantitative precipitation
    let precipSum = 0
    let plotQPrec = false
    for (let i = 0; i < todayPrecipForecast['quantitativePrecipitation'].data.length; i++) {
        if (todayPrecipForecast['quantitativePrecipitation'].data[i] > 0) {
            plotQPrec = true
            break
        }
    }
    
    const layoutTodayPrecip = {
        height: 200,
        paper_bgcolor:'rgba(0,0,0,0)',
        plot_bgcolor:'rgba(0,0,0,0)',
        title: 'Precipitation',
        xaxis: {
            type:'date',
            tickformat: '%-I %p',
            fixedrange: true,
            range: timeRange,
            showgrid:false,
        },
        yaxis: {
            fixedrange: true,
            range: [0,101],
            showgrid:false,
            gridcolor:'rgba(0,0,0,0.25)',
            title: '% Chance',                                            
        },
        
        showlegend: false,
        margin: {b:30, t:40,l:40,r:50},
    }

    let tracesTodayPrecip = [{
        x: todayPrecipForecast['probabilityOfPrecipitation'].time,
        y: todayPrecipForecast['probabilityOfPrecipitation'].data,
        mode: 'lines',
        type: 'scatter',
        line: {
            color: '#444',
            width: 3,
        },
        name: '% Chance',
        yaxis: 'y1',
    }]
    const configTodayPrecip = {
        responsive: true,
        displayModeBar: false,
    }
    if (plotQPrec) {
        const maxInch = Math.max(...todayPrecipForecast['quantitativePrecipitation'].data)
        tracesTodayPrecip = [
        {
            x: todayPrecipForecast['quantitativePrecipitation'].time,
            y: todayPrecipForecast['quantitativePrecipitation'].data,
            type: 'bar',
            yaxis: 'y2',
            name: 'Inches',
            marker: {color: '#1F77B4', opacity: 0.6},
        }, tracesTodayPrecip[0]]
        
        layoutTodayPrecip.yaxis2 = {
            title: 'Inches',
            titlefont: {color: '#1F77B4'},
            tickfont: {color: '#1F77B4'},
            overlaying: 'y',
            side: 'right',
            fixedrange: true,

        }
        const minInchRange = 0.2
        if (maxInch < minInchRange) {
            layoutTodayPrecip.yaxis2.range = [0,minInchRange]
        }
        
        layoutTodayPrecip.yaxis2.overlaying = 'y1'
    }
    Plotly.newPlot(elem2, tracesTodayPrecip, layoutTodayPrecip, configTodayPrecip)
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
            const fields = ['temperature', 'apparentTemperature', 'probabilityOfPrecipitation', 'quantitativePrecipitation']
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
                content.style.width = '100%'
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
                    div2.style.width = "100%"
                    div2.style.display = "inline-block"
                    const elem = content.appendChild(div2)
                    
                    // Determine if apparent temp is different from actual
                    let plotApparent = false
                    for (let i = 0; i < tempData['temperature'].data.length; i++) {
                        if (Math.abs(tempData['temperature'].data[i]-tempData['apparentTemperature'].data[i]) > 0) {
                            plotApparent = true
                            break
                        }
                    }
                    const timeRange = [thisDate.plus({minutes:zoneData.offset}).toJSDate(), thisDate.plus({days:1}).plus({minutes:zoneData.offset}).toJSDate()]
                    
                    //  Temperature line plot
                    const layout2 = {
                        height: 200,
                        paper_bgcolor:'rgba(0,0,0,0)',
                        plot_bgcolor:'rgba(0,0,0,0)',
                        title: 'Temperature (' + degreeSymbol + 'F)',
                        xaxis: {
                            type:'date',
                            tickformat: '%-I %p',
                            fixedrange: true,
                            showgrid:false,
                            range: timeRange,
                        },
                        yaxis: {
                            fixedrange: true,
                            showgrid: false,
                            gridcolor:'rgba(0,0,0,0.25)',
                        },
                        legend: {
                            x: 1,
                            y: 1,
                            xanchor: 'right',
                            yanchor: 'top',
                            traceorder: 'reversed',
                        },
                        margin: {b:30, t:40,l:30,r:30},
                    }
                    
                    if (!plotApparent)
                        layout2.showlegend = false

                    const config2 = {
                        responsive: true,
                        displayModeBar: false,
                    }

                    const traces2 = Array(2)
                    traces2[0] = {
                        x: tempData['apparentTemperature'].time,
                        y: tempData['apparentTemperature'].data,
                        mode:'lines',
                        type:'scatter',
                        line: {
                            color: '#888',
                            width: 3,
                        },
                        name: 'Feels Like',
                    }
                    traces2[1] = {
                        x: tempData['temperature'].time,
                        y: tempData['temperature'].data,
                        mode:'lines',
                        type:'scatter',
                        line: {
                            color: '#000',
                            width: 3,
                        },
                        name: 'Actual',
                    }
                    
                    if (plotApparent)
                        Plotly.newPlot(elem, traces2, layout2, config2)
                    else
                        Plotly.newPlot(elem, [traces2[1]], layout2, config2)
                        
                    //  Elem2 = div for precipitation plot
                    const div3 = document.createElement('div')
                    div3.style.width = "100%"
                    div3.style.display = "inline-block"
                    const elem2 = content.appendChild(div3)

                    //  Precipitation plot
                    //  Determine whether to show inches bar chart
                    //  Sum over all quantitative precipitation
                    let precipSum = 0
                    tempData['quantitativePrecipitation'].data.forEach(function (value, index) {
                        precipSum += value
                    })
                    const plotQPrec = (precipSum > 0)
                    
                    const layout3 = {
                        height: 200,
                        paper_bgcolor:'rgba(0,0,0,0)',
                        plot_bgcolor:'rgba(0,0,0,0)',
                        title: 'Precipitation',
                        xaxis: {
                            type:'date',
                            tickformat: '%-I %p',
                            fixedrange: true,
                            range: timeRange,
                            showgrid:false,
                        },
                        yaxis: {
                            fixedrange: true,
                            range: [0,101],
                            showgrid:false,
                            gridcolor:'rgba(0,0,0,0.25)',
                            title: '% Chance',                                            
                        },
                        
                        showlegend: false,
                        margin: {b:30, t:40,l:40,r:50},
                    }

                    let traces3 = [{
                        x: tempData['probabilityOfPrecipitation'].time,
                        y: tempData['probabilityOfPrecipitation'].data,
                        mode: 'lines',
                        type: 'scatter',
                        line: {
                            color: '#444',
                            width: 3,
                        },
                        name: '% Chance',
                        yaxis: 'y1',
                    }]
                    
                    if (plotQPrec) {
                        const maxInch = Math.max(...tempData['quantitativePrecipitation'].data)
                        traces3 = [{
                        x: tempData['quantitativePrecipitation'].time,
                        y: tempData['quantitativePrecipitation'].data,
                        type: 'bar',
                        yaxis: 'y2',
                        name: 'Inches',
                        marker: {color: '#1F77B4', opacity: 0.6},
                        }, traces3[0]]
                        
                        layout3.yaxis2 = {
                            title: 'Inches',
                            titlefont: {color: '#1F77B4'},
                            tickfont: {color: '#1F77B4'},
                            overlaying: 'y',
                            side: 'right',
                            fixedrange: true,

                        }
                        
                        const minInchRange = 0.2
                        if (maxInch < minInchRange) {
                            layout3.yaxis2.range = [0,minInchRange]
                        }
                        
                        layout3.yaxis2.overlaying = 'y1'
                    }
                    Plotly.newPlot(elem2, traces3, layout3, config2)
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
