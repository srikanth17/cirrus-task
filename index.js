let myApp = angular.module('myApp',['chart.js', 'moment-picker']);

myApp.controller('AppCtrl',['$scope', '$http', function($scope, $http) {
    const key = 'y1hU64Dz4l';
    const group = 'Cirrus Environmental';
    const baseURL = 'https://managed2.noisehub.co.uk/api';

    $scope.yesterday = moment().subtract(1, 'day');
    $scope.startDate = '2018-01-15 10:00';
    $scope.endDate = '2018-01-15 10:10';

    $scope.getId = function () {
        $http.get(`${baseURL}/session/new?key=${key}&group=${group}`).then(function (response) {
            guid = response.data.Id;
            $http.get(`${baseURL}/${guid}/instrument`).then(function (response) {
                $scope.instruments = response.data;
                $scope.selectInstrument = $scope.instruments[0];
            }, function (error) {
                console.log(error);
            });
        }, function (error) {
            console.log(error);
        });
    };
    $scope.getId();

    $scope.selectedInstrument = function () {
        console.log($scope.selectInstrument);
        $scope.connecting = true;
        $scope.liveDataTypes = false;
        $scope.timeHistoryTypes = false;
        $scope.id = $scope.selectInstrument.Id;
        connectToInstrument();
    };

    function instrumentDetails() {
        $http.get(`${baseURL}/${guid}/instrument/${$scope.id}`).then(({ data }) => {
            console.log(data);
            $scope.liveDataTypes = data.LiveDataTypes;
            $scope.selectLiveDataTypes = $scope.liveDataTypes[0];
            $scope.liveDataLabel = $scope.liveDataTypes[0];
            $scope.getLiveData($scope.selectLiveDataTypes);
            $scope.timeHistoryTypes = data.TimeHistoryTypes;
            $scope.selectTimeHistoryTypes = $scope.timeHistoryTypes[0];
            $scope.historyDataLabel = $scope.timeHistoryTypes[0];
            $scope.getHistoryData($scope.selectTimeHistoryTypes, $scope.startDate, $scope.endDate);
        }, function (error) {
            console.log(error);
        });
    }

    function connectToInstrument() {
        $http.get(`${baseURL}/${guid}/live/${$scope.id}/LAF`).then(({ data }) => {
            console.log(data);
            if(data.Error === 'NotConnected' && data.IsConnecting === true) {
                let split1 = data.Retry.split(':');
                let split2 = split1[2].split('+');
                let s1 = Math.round(split2[0]);
                let s2 = new Date().getSeconds();
                let retry = (s1-s2)*1000;
                setTimeout(() => {
                    connectToInstrument();
                }, retry);
            } else {
                instrumentDetails();
            }
        }, function (error) {
            console.log(error);
        });
    }

    $scope.getLiveData = function (type) {
        $scope.liveDataNotAvailable = false;
        $scope.connecting = false;
        limit = 0;
        $scope.showingLiveData = true;

        let ctx = document.getElementById("liveChart").getContext('2d');
        liveChart = new Chart(ctx, {
            // The type of chart we want to create
            type: 'line',

            // The data for our dataset
            data: {
                labels: [],
                datasets: [{
                    label: $scope.liveDataLabel,
                    //backgroundColor: 'rgb(255, 99, 132)',
                    borderColor: 'rgb(255, 99, 132)',
                    data: [],
                }]
            },

            // Configuration options go here
            options: {
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero:true
                        }
                    }]
                }
            }
        });

        stop = setInterval(() => {

            $http.get(`${baseURL}/${guid}/live/${$scope.id}/${type}`).then(({ data }) => {
                //console.log(data);
                if(data.Error === 'NotConnected' && data.IsConnecting === true) {
                    liveChart.destroy();
                    $scope.showingLiveData = false;
                    $scope.liveDataNotAvailable = true;
                } else {
                    $scope.showingLiveData = false;
                    let split1 = data.Time.split('T');
                    let split2 = split1[1].split('.');

                    if(limit === 10) {
                        liveChart.data.labels.shift();
                        liveChart.data.labels.push(split2[0]);
                        liveChart.data.datasets[0].data.shift();
                        liveChart.data.datasets[0].data.push(data.Level);
                    } else {
                        liveChart.data.labels.push(split2[0]);
                        liveChart.data.datasets[0].data.push(data.Level);
                        limit++;
                    }

                    liveChart.update();
                }
            });

        }, 1000);
    };

    $scope.startDateChanged = function (type, newValue, oldValue) {
        if(newValue !== oldValue) {
            $scope.startDate = newValue._i;
            $scope.changeHistoryData(type, $scope.startDate, $scope.endDate);
        }
    };

    $scope.endDateChanged = function (type, newValue, oldValue) {
        if(newValue !== oldValue) {
            $scope.endDate = newValue._i;
            $scope.changeHistoryData(type, $scope.startDate, $scope.endDate);
        }
    };

    $scope.changeHistoryData = function (type, startDate, endDate) {
        if(historyChart !== undefined && historyChart !== null) {
            historyChart.destroy();
        }
        $scope.historyDataLabel = type;
        $scope.getHistoryData(type, startDate, endDate);
    };

    $scope.getHistoryData = function (type, startDate, endDate) {

        $scope.showingHistoryData = true;
        if(startDate === endDate) {
            $scope.noData = true;
            $scope.showingHistoryData = false;
            return;
        }

        $http.get(`${baseURL}/${guid}/timehistory/${$scope.id}/${type}?start=${startDate}&end=${endDate}`)
            .then(({ data }) => {
                if(data.Error === 'NotAvailable' && data.IsDownloading === true) {
                    setTimeout(() => {
                        $scope.getHistoryData(type, startDate, endDate);
                    }, 60000);

                    console.log(data);
                } else {
                    $scope.showingHistoryData = false;
                    console.log(data);

                    let ctx = document.getElementById("historyChart").getContext('2d');
                    historyChart = new Chart(ctx, {
                        // The type of chart we want to create
                        type: 'line',

                        // The data for our dataset
                        data: {
                            labels: [],
                            datasets: [{
                                label: $scope.historyDataLabel,
                                //backgroundColor: 'rgb(255, 99, 132)',
                                borderColor: 'rgb(255, 99, 132)',
                                data: [],
                            }]
                        },

                        // Configuration options go here
                        options: {
                            scales: {
                                yAxes: [{
                                    ticks: {
                                        beginAtZero:true
                                    }
                                }]
                            }
                        }
                    });

                    for (let i=1;i<data.length;i++) {
                        let obj = data[i];
                        let label = obj.StartTime.split('T');
                        let date = label[0].split('-');
                        let time = label[1].split(':');
                        let m = moment(new Date(date[0], date[1]-1, date[2], time[0], time[1], time[2]));
                        obj.Values.forEach((val) => {
                            historyChart.data.labels.push(m.add(1, 'seconds').format('h:mm:ss'));
                            historyChart.data.datasets[0].data.push(val);
                        });
                    }
                    historyChart.update();

                }
            });
    };

    $scope.changeLiveData = function (type) {
        if(liveChart !== undefined && liveChart !== null) {
            liveChart.destroy();
        }
        clearInterval(stop);
        $scope.liveDataLabel = type;
        $scope.getLiveData(type);
    };

}]);