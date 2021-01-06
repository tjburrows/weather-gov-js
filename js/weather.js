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

function todayPlots(gridProps, todayObservationsJson, stationID, plotdiv, todayMidnight, lastMidnight, firstTime) {
    const todayFields = ['temperature']
    
    var minTemp
    var maxTemp
    var todayIcon
    todayObservationsJson.features = todayObservationsJson.features.slice(1,)
    const lenObs = todayObservationsJson.features.length
    var plotObservations = lenObs  > 0
    let obsData = {'temperature':[], 'time':[]}
    let todayForecast
    let mostRecentObsTimeMinus1hr
    var tomorrow1am = new Date(todayMidnight)
    tomorrow1am.setHours(tomorrow1am.getHours() + 1)
    if (plotObservations) {
        todayIcon = todayObservationsJson.features[0].properties.icon
        const mostRecentObsTime = new Date(todayObservationsJson.features[0].properties.timestamp)
        mostRecentObsTimeMinus1hr = new Date(mostRecentObsTime)
        mostRecentObsTimeMinus1hr.setHours(mostRecentObsTimeMinus1hr.getHours() - 1)
        for (let i = 0; i < lenObs; i++) {
            if (todayObservationsJson.features[lenObs - 1 - i].properties.temperature.value != null) {
                if (todayObservationsJson.features[lenObs - 1 - i].properties.temperature.unitCode.includes('degC')) {
                    todayObservationsJson.features[lenObs - 1 - i].properties.temperature.value = c2f(todayObservationsJson.features[lenObs - 1 - i].properties.temperature.value)
                    todayObservationsJson.features[lenObs - 1 - i].properties.temperature.unitCode = 'degF'
                }
                obsData.temperature.push(todayObservationsJson.features[lenObs - 1 - i].properties.temperature.value)
                obsData.time.push(new Date(todayObservationsJson.features[lenObs - 1 - i].properties.timestamp))
            }
        }
        todayForecast = generateDataOnDate2(gridProps, todayFields, mostRecentObsTimeMinus1hr, tomorrow1am)
    }
    else {
        todayForecast = generateDataOnDate2(gridProps, todayFields, firstTime, tomorrow1am)
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
            range: [lastMidnight, todayMidnight],
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
        todayPrecipForecast = generateDataOnDate2(gridProps, ['quantitativePrecipitation', 'probabilityOfPrecipitation'], mostRecentObsTimeMinus1hr, tomorrow1am)
    else
        todayPrecipForecast = generateDataOnDate2(gridProps, ['quantitativePrecipitation', 'probabilityOfPrecipitation'], firstTime, tomorrow1am)

    //  Determine whether to show inches bar chart
    //  Sum over all quantitative precipitation
    let precipSum = 0
    todayPrecipForecast['quantitativePrecipitation'].data.forEach(function (value, index) {
        precipSum += value
    })
    const plotQPrec = (precipSum > 0)
    
    const layoutTodayPrecip = {
        height: 200,
        paper_bgcolor:'rgba(0,0,0,0)',
        plot_bgcolor:'rgba(0,0,0,0)',
        title: 'Precipitation',
        xaxis: {
            type:'date',
            tickformat: '%-I %p',
            fixedrange: true,
            range: [lastMidnight, todayMidnight],
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

//  Get weather data
const degreeSymbol = String.fromCharCode(176)
async function getWeather(lat, lon, reverseGeo=false) {

    if (reverseGeo) {
        reverseGeocode(lat,lon)
    }

    clearID('days')
    clearID('today')
    clearID('errors')
    clearID('summary')
    clearID('conditions')
    
    
    var stationID
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
    console.log(fetchPoints)
    const pointsJson = await (() => {return fetchPoints.json()})()
    console.log(pointsJson)
    if (pointsJson == null || pointsJson.length == 0) {
            printError('Error: Weather at this location is not available from Weather.gov.')
    }
    else {
        clearID('conditions')
        const fetch_points = fetch_retry(pointsJson.properties.observationStations, fetchOptions, 10)
        const fetch_forecast = fetch_retry(pointsJson.properties.forecast, fetchOptions, 10)
        const [response_points, respose_forecast] = await Promise.all([fetch_points, fetch_forecast]);
        const [stationsJson] = await Promise.all([(() => {return response_points.json()})()]);
        const fetch_grid = fetch_retry(pointsJson.properties.forecastGridData, fetchOptions, 10)
        
        const station = stationsJson.features[0]
        console.log('station:', station)
        let elevation = station.properties.elevation.value
        if (station.properties.elevation.unitCode.includes('unit:m'))
            elevation = m2ft(elevation)
        stationID = station.properties.stationIdentifier
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

        //  Create day by day summary
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
        
        //  Create detailed forecasts
        const [reponse_grid] = await Promise.all([fetch_grid]);
        const gridJson =  await (async () => {return await reponse_grid.json()})()
        if (gridJson == null || gridJson.length == 0 || gridJson.properties == undefined) {
            printError('Error: Weather at this location is not available from Weather.gov.')
        }
        else {
            console.log('grid:', gridJson)
            const gridProps = gridJson.properties
            const firstTime = new Date(gridProps.temperature.values[0].validTime.split('/')[0])

            let todayMidnight = new Date()  
            todayMidnight.setHours(24)
            todayMidnight.setMinutes(0)
            todayMidnight.setSeconds(0)
            todayMidnight.setMilliseconds(0)
            if (firstTime == todayMidnight)
                todayMidnight.setDate(todayMidnight.getDate()+1)
            let lastMidnight = new Date(todayMidnight)
            lastMidnight.setDate(lastMidnight.getDate() - 1)
            let yesterday11pm = new Date(lastMidnight)
            yesterday11pm.setHours(yesterday11pm.getHours()-1)
            
            const response_obs = await fetch_retry('https://api.weather.gov/stations/' + stationID + '/observations?start=' + encodeURIComponent(lastMidnight.toISOString().slice(0,-5) + '+00:00'), fetchOptions, 5)
            const todayObservationsJson =  await (async () => {return await response_obs.json()})()
            
            console.log("todays observations:", todayObservationsJson)
                        
            //  Match min temperature to max temperature
            const minDate0 = gridProps.minTemperature.values[0].validTime.split('T')[0]
            const maxDate0 = gridProps.maxTemperature.values[0].validTime.split('T')[0]
            if (minDate0 != maxDate0) {
                if (minDate0 < maxDate0)
                    gridProps.minTemperature.values = gridProps.minTemperature.values.slice(1)
                else
                    gridProps.maxTemperature.values = gridProps.maxTemperature.values.slice(1)
            }
            const minDateEnd = gridProps.minTemperature.values.slice(-1)[0].validTime.split('T')[0]
            const maxDateEnd = gridProps.maxTemperature.values.slice(-1)[0].validTime.split('T')[0]
            if (minDateEnd != maxDateEnd) {
                if (minDateEnd > maxDateEnd)
                    gridProps.minTemperature.values = gridProps.minTemperature.values.slice(0,-1)
                else
                    gridProps.maxTemperature.values = gridProps.maxTemperature.values.slice(0,-1)
            }
            
            if ((new Date(gridProps.minTemperature.values[0].validTime.split('T')[0])).getUTCDate() < new Date().getDate()) {
                gridProps.minTemperature.values = gridProps.minTemperature.values.slice(1)
                gridProps.maxTemperature.values = gridProps.maxTemperature.values.slice(1)
            }

            let numBars = gridProps.minTemperature.values.length

            //  Convert celcius to farenheit
            if (gridProps.minTemperature.uom.includes('degC')) {
                for (let i = 0; i < numBars; i++) {
                    gridProps.minTemperature.values[i].value = c2f(gridProps.minTemperature.values[i].value)
                    gridProps.maxTemperature.values[i].value = c2f(gridProps.maxTemperature.values[i].value)
                }
                gridProps.minTemperature.uom = 'degF'
                gridProps.maxTemperature.uom = 'degF'
            }

            //   Find common min and max for all bar charts
            let minT = gridProps.minTemperature.values[0].value
            let maxT = gridProps.maxTemperature.values[0].value
            for (let i = 1; i < numBars; i++) {
                if (gridProps.minTemperature.values[i].value < minT)
                    minT = gridProps.minTemperature.values[i].value
                if (gridProps.maxTemperature.values[i].value > maxT)
                    maxT = gridProps.maxTemperature.values[i].value
            }

            //  Generate data arrays
            var todayIsIdx0 = ((new Date(gridProps.minTemperature.values[0].validTime.split('T')[0])).getUTCDate() == new Date().getDate())
            
            const validDay = Array(numBars)
            let i = 0
            var thisIsToday = (i == 0 && !todayIsIdx0) || todayIsIdx0
            var currentDay, todayData
            while (i < numBars) {
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
                
                // create content of collapsible
                if (thisIsToday) {
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
                    todayData = todayPlots(gridProps, todayObservationsJson, stationID,content, todayMidnight, lastMidnight, firstTime)     
                    
                    if (todayIsIdx0) {
                        // find corresponding day.  If Daytime available, choose it.  else choose nighttime.
                        for (let d = 0; d < dayPeriods.length; d++) {
                            if (dayPeriods[d].startTime.split('T')[0] == gridProps.minTemperature.values[0].validTime.split('T')[0]) {
                                if (dayPeriods[d].isDaytime) {
                                    currentDay = dayPeriods[d]
                                    break
                                }
                                else {
                                    currentDay = dayPeriods[d]
                                    break
                                }
                            }
                        }
                        todayData.icon = currentDay.icon
                    }
                }
                if (!thisIsToday) {
                    validDay[i] = gridProps.minTemperature.values[i].validTime.split('T')[0]
                
                    // find corresponding day.  If Daytime available, choose it.  else choose nighttime.
                    for (let d = 0; d < dayPeriods.length; d++) {
                        if (dayPeriods[d].startTime.split('T')[0] == validDay[i]) {
                            if (dayPeriods[d].isDaytime) {
                                currentDay = dayPeriods[d]
                                break
                            }
                            else {
                                currentDay = dayPeriods[d]
                                break
                            }
                        }
                    }
                    
                    const localMidnight = new Date(validDay[i])
                    localMidnight.setMinutes(localMidnight.getMinutes() + localMidnight.getTimezoneOffset())
                    const tempData = generateDataOnDate(gridProps, ['temperature'], localMidnight, 25)['temperature'].data
                    
                    // Overwrite min and max based on temperature profiles (hacky)
                    let minti = tempData[0]
                    let maxti = tempData[0]
                    for (let t = 1; t < tempData.length; t++) {
                        if (tempData[t] > maxti)
                            maxti = tempData[t]
                        if (tempData[t] < minti)
                            minti = tempData[t]
                    }
                    gridProps.minTemperature.values[i].value = minti
                    gridProps.maxTemperature.values[i].value = maxti

                    buttonElem.onclick =  function(i) {
                        return function() {
                        this.classList.toggle("active");
                        const content = this.nextElementSibling
                        if (content.style.maxHeight){
                            content.style.maxHeight = null;
                        } else {
                            if (!content.classList.contains('generated')) {
                                content.classList.add("generated")

                                const fields = ['temperature', 'apparentTemperature', 'probabilityOfPrecipitation', 'quantitativePrecipitation']
                                const localMidnight = new Date(validDay[i])
                                localMidnight.setMinutes(localMidnight.getMinutes() + localMidnight.getTimezoneOffset())
                                const tempData = generateDataOnDate(gridProps, fields, localMidnight, 25)
                                const xmin = localMidnight
                                const xmax = new Date(xmin)
                                xmax.setHours(xmax.getHours() + 24)
                                
                                //  add day description (not working yet)
//                                         const div1 = document.createElement('div')
//                                         const text = document.createTextNode(currentDay.detailedForecast)
//                                         div1.appendChild(text)
//                                         div1.style.width = "90%"
//                                         div1.style.display = "inline-block"
//                                         content.appendChild(div1)
                                
                                //  Elem = div for temperature plot
                                const div2 = document.createElement('div')
                                div2.style.width = "100%"
                                div2.style.display = "inline-block"
                                const elem = content.appendChild(div2)
                                
                                // Determine if apparent temp is different from actual
                                let tdiff = 0
                                for (let i = 0; i < tempData['temperature'].data.length; i++)
                                    tdiff += Math.abs(tempData['temperature'].data[i]-tempData['apparentTemperature'].data[i])
                                let plotApparent = (tdiff > 0)

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
                                        range: [xmin, xmax],
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
                                        range: [xmin, xmax],
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
                            content.style.maxHeight = content.scrollHeight + "px";
                        }
                    }}(i)
                }
                
                //  D3 bar
                if (thisIsToday) {
                    minT = todayData.minTemp < minT ? todayData.minTemp : minT
                    maxT = todayData.maxTemp > maxT ? todayData.maxTemp : maxT
                }
                const iconSize = 40
                const iconSpace = 10
                const svgBarBoxH = 50
                const svgBarH = 20
                const svgBarTextWidth = 50
                const svgBarLabelPadding = 45
                const svgBarDegreeLabelPadding = 4
                const xExtent = [minT, maxT]
                const plusPadding = 14
                const xRange = [svgBarTextWidth + svgBarLabelPadding, buttonElem.clientWidth - svgBarLabelPadding - plusPadding - iconSize - iconSpace]
                const barXScale = d3.scaleLinear().range(xRange).domain(xExtent)
                const dateFormatter = d3.timeFormat('%a')
                const dateParser = d3.timeParse('%Y-%m-%d')
                const weatherIcon = document.createElement("img")
                weatherIcon.src = todayIsIdx0 ? currentDay.icon : thisIsToday ? todayData.icon : currentDay.icon
                if (!thisIsToday) {
                    weatherIcon.alt = currentDay.shortForecast
                    weatherIcon.title = currentDay.shortForecast
                }
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
                    .text(thisIsToday ? 'Today' : dateFormatter(dateParser(validDay[i])))
                const xScaleMin = barXScale(thisIsToday ? todayData.minTemp : gridProps.minTemperature.values[i].value)
                const xScaleMax = barXScale(thisIsToday ? todayData.maxTemp : gridProps.maxTemperature.values[i].value)
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
                    .text(Math.round(thisIsToday ? todayData.minTemp : gridProps.minTemperature.values[i].value).toString() + degreeSymbol)
                svgBar.append('text')
                    .attr('x', xScaleMax + svgBarDegreeLabelPadding + circleR)
                    .attr('y', 0.5 * svgBarBoxH)
                    .attr('text-anchor', 'start')
                    .attr('dominant-baseline', 'middle')
                    .text(Math.round(thisIsToday ? todayData.maxTemp : gridProps.maxTemperature.values[i].value).toString() + degreeSymbol)
                
                // create content of collapsible
                if (!thisIsToday) {
                    const content = document.createElement('div')
                    content.classList.add('content')
                    content.style.width = '100%'
                    document.getElementById("days").appendChild(content)
                }
                if (thisIsToday && !todayIsIdx0) {
                    i -= 1
                }
                i += 1
                if (thisIsToday)
                    thisIsToday = false
                }
        }
       
    }
}


geocode()
