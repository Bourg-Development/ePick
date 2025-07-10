document.addEventListener('DOMContentLoaded', function() {
    // Initialize API
    api.setConfig({
        baseURL: '/api',
        timeout: 15000
    });

    // Dashboard state
    let dashboardData = {
        metrics: {},
        schedule: [],
        activity: [],
        charts: {}
    };

    let refreshInterval;
    let scheduleViewMode = 'timeline'; // 'timeline' or 'list'

    // Initialize dashboard
    initializeDashboard();

    async function initializeDashboard() {
        setupEventListeners();
        await loadUserProfile();
        await loadDashboardData();
        setupCharts();
        startAutoRefresh();
    }

    function setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refreshDashboard');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                refreshDashboard();
            });
        }

        // Schedule view toggle
        const scheduleToggle = document.getElementById('scheduleViewToggle');
        if (scheduleToggle) {
            scheduleToggle.addEventListener('click', toggleScheduleView);
        }

        // Date range selector (placeholder for future implementation)
        const dateRangeSelector = document.querySelector('.date-range-selector');
        if (dateRangeSelector) {
            dateRangeSelector.addEventListener('click', () => {
                // Future: show date range picker
                console.log('Date range selector clicked');
            });
        }
    }

    async function loadUserProfile() {
        try {
            const result = await api.get('/user/profile');
            if (result.success && result.profile) {
                const profile = result.profile;
                const welcomeEl = document.getElementById('welcomeMessage');
                if (welcomeEl) {
                    const displayName = profile.full_name || profile.username || 'User';
                    welcomeEl.textContent = `Welcome back, ${displayName}`;
                }
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            // Keep default welcome message
        }
    }

    async function loadDashboardData() {
        try {
            showLoadingState();
            
            const promises = [
                loadMetrics(),
                loadTodaySchedule(),
                loadRecentActivity(),
                loadServiceStatus()
            ];

            await Promise.allSettled(promises);
            hideLoadingState();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            showErrorState('Failed to load dashboard data');
        }
    }

    async function loadMetrics() {
        try {
            // Load analyses metrics
            const analysesResult = await api.get('/analyses', {
                params: {
                    limit: 1000,
                    startDate: getDateRange().start,
                    endDate: getDateRange().end
                }
            });

            if (analysesResult.success) {
                const analyses = analysesResult.data || [];
                const today = new Date().toDateString();
                
                // Calculate metrics
                const todayAnalyses = analyses.filter(a => {
                    const analysisDate = new Date(a.analysis_date).toDateString();
                    return analysisDate === today;
                });
                
                const pendingAnalyses = analyses.filter(a => {
                    const status = a.status?.toLowerCase();
                    return status === 'pending' || status === 'delayed';
                });
                
                const completedAnalyses = analyses.filter(a => {
                    const status = a.status?.toLowerCase();
                    return status === 'completed';
                });

                const completionRate = analyses.length > 0 
                    ? Math.round((completedAnalyses.length / analyses.length) * 100)
                    : 0;


                // Update metrics display
                updateMetricsDisplay({
                    totalAnalysesToday: todayAnalyses.length,
                    pendingAnalyses: pendingAnalyses.length,
                    completionRate: completionRate,
                    urgentPending: pendingAnalyses.filter(a => a.status?.toLowerCase() === 'delayed').length
                });

                dashboardData.metrics.analyses = analyses;
            }

            // Room occupancy feature removed as requested

        } catch (error) {
            console.error('Error loading metrics:', error);
        }
    }

    async function loadTodaySchedule() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const result = await api.get('/analyses', {
                params: {
                    startDate: today,
                    endDate: today,
                    limit: 50
                }
            });

            if (result.success) {
                const schedule = result.data || [];
                dashboardData.schedule = schedule;
                renderSchedule(schedule);
            } else {
                showScheduleEmpty();
            }
        } catch (error) {
            console.error('Error loading schedule:', error);
            showScheduleEmpty();
        }
    }

    async function loadRecentActivity() {
        // Check if Recent Activity card exists (admin only)
        const activityCard = document.getElementById('recentActivityCard');
        if (!activityCard) {
            return; // Skip loading if card is not present
        }

        try {
            const result = await api.get('/dashboard/activity', {
                params: { limit: 10 }
            });

            if (result.success && result.data) {
                const activity = result.data || [];
                dashboardData.activity = activity;
                renderActivity(activity);
            } else {
                showActivityEmpty();
            }
        } catch (error) {
            console.error('Error loading activity:', error);
            showActivityEmpty();
        }
    }

    async function loadServiceStatus() {
        try {
            console.log('Loading service status...');
            const result = await api.get('/user/profile');
            console.log('Profile result:', result);
            
            if (result.success && result.profile) {
                const profile = result.profile;
                
                // Update service status
                const serviceNameEl = document.getElementById('currentServiceName');
                const serviceName = profile.service || profile.service_name || 'No service assigned';
                
                if (serviceNameEl) {
                    serviceNameEl.textContent = serviceName;
                }

                // Load additional service metrics
                // Filter by service name since we have that in the profile
                const currentServiceName = profile.service;
                console.log('Current service name from profile:', currentServiceName);
                
                const [usersResult, roomsResult] = await Promise.allSettled([
                    api.get('/admin/users?limit=100'),
                    api.get('/admin/rooms')
                ]);

                console.log('Users API result:', usersResult);
                if (usersResult.status === 'fulfilled') {
                    console.log('Users API response details:', {
                        success: usersResult.value.success,
                        data: usersResult.value.data,
                        pagination: usersResult.value.pagination,
                        total: usersResult.value.total,
                        message: usersResult.value.message
                    });
                }
                console.log('Rooms API result:', roomsResult);

                const activeUsersEl = document.getElementById('activeUsers');
                if (activeUsersEl) {
                    if (usersResult.status === 'fulfilled' && usersResult.value.success) {
                        const users = usersResult.value.data || [];
                        console.log('Total users returned:', users.length);
                        
                        if (users.length > 0) {
                            // Filter users by service name - check service object structure
                            console.log('Current service name:', currentServiceName);
                            console.log('First few users:', users.slice(0, 3).map(u => ({
                                username: u.username,
                                service: u.service,
                                service_name: u.service_name
                            })));
                            
                            const serviceUsers = users.filter(u => {
                                const userServiceName = u.service?.name || u.service_name || u.service;
                                return userServiceName === currentServiceName;
                            });
                            
                            console.log('Service users found:', serviceUsers.length, 'out of', users.length, 'total users');
                            activeUsersEl.textContent = serviceUsers.length;
                        } else {
                            console.log('No users returned from API, showing fallback value');
                            // API returned empty array - show at least 1 since current user is in service
                            activeUsersEl.textContent = '1';
                        }
                    } else {
                        console.log('Users API failed or not successful:', usersResult);
                        // API failed - show at least 1 since current user is in service
                        activeUsersEl.textContent = '1';
                    }
                }

                if (roomsResult.status === 'fulfilled' && roomsResult.value.success) {
                    const rooms = roomsResult.value.data || [];
                    const totalRoomsEl = document.getElementById('totalRooms');
                    if (totalRoomsEl) {
                        // For rooms, show total since rooms might not have service name field
                        totalRoomsEl.textContent = rooms.length;
                    }
                }
            }
        } catch (error) {
            console.error('Error loading service status:', error);
            // Show error state
            const serviceNameEl = document.getElementById('currentServiceName');
            if (serviceNameEl) {
                serviceNameEl.textContent = 'Error loading service';
            }
        }
    }

    function updateMetricsDisplay(metrics) {
        
        // Update today's analyses
        const totalAnalysesEl = document.getElementById('totalAnalysesToday');
        if (totalAnalysesEl) {
            // Direct update for testing
            totalAnalysesEl.textContent = metrics.totalAnalysesToday;
            // animateNumber(totalAnalysesEl, metrics.totalAnalysesToday);
        }

        // Update pending analyses
        const pendingAnalysesEl = document.getElementById('pendingAnalyses');
        if (pendingAnalysesEl) {
            // Direct update for testing
            pendingAnalysesEl.textContent = metrics.pendingAnalyses;
            // animateNumber(pendingAnalysesEl, metrics.pendingAnalyses);
        }

        // Update completion rate
        const completionRateEl = document.getElementById('completionRate');
        if (completionRateEl) {
            // Direct update for testing
            completionRateEl.textContent = metrics.completionRate + '%';
            // animateNumber(completionRateEl, metrics.completionRate, '%');
        }

        // Update pending status
        const pendingStatusEl = document.getElementById('pendingStatus');
        if (pendingStatusEl) {
            const urgentText = metrics.urgentPending > 0 ? `${metrics.urgentPending} urgent` : 'none urgent';
            pendingStatusEl.textContent = urgentText;
        }

        // Change indicators removed from UI
    }

    // Room occupancy display function removed

    function renderSchedule(schedule) {
        const scheduleLoader = document.getElementById('scheduleLoader');
        const scheduleContent = document.getElementById('scheduleContent');
        const scheduleEmpty = document.getElementById('scheduleEmpty');

        if (schedule.length === 0) {
            showScheduleEmpty();
            return;
        }

        // Hide loader and empty state
        if (scheduleLoader) scheduleLoader.style.display = 'none';
        if (scheduleEmpty) scheduleEmpty.style.display = 'none';
        if (scheduleContent) scheduleContent.style.display = 'block';

        // Render based on current view mode
        if (scheduleViewMode === 'timeline') {
            renderScheduleTimeline(schedule);
        } else {
            renderScheduleList(schedule);
        }
    }

    function renderScheduleTimeline(schedule) {
        const timelineEl = document.getElementById('scheduleTimeline');
        if (!timelineEl) return;

        const sortedSchedule = schedule.sort((a, b) => 
            new Date(a.analysis_date) - new Date(b.analysis_date)
        );

        timelineEl.innerHTML = sortedSchedule.map(item => `
            <div class="timeline-item">
                <div class="timeline-content">
                    <div class="timeline-title">
                        ${item.patient?.name || 'Patient'} - ${item.analysis_type ? `${item.analysis_type} Analysis` : 'Blood Analysis'}
                    </div>
                    <div class="timeline-details">
                        Room: ${item.room?.room_number || 'Unassigned'} | Doctor: ${item.doctor?.name || 'Unassigned'}
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderScheduleList(schedule) {
        const listEl = document.getElementById('scheduleList');
        if (!listEl) return;

        listEl.innerHTML = schedule.map(item => `
            <div class="schedule-item">
                <div class="schedule-status ${item.status}"></div>
                <div class="schedule-info">
                    <div class="schedule-patient">
                        ${item.patient?.name || 'Patient'}
                    </div>
                    <div class="schedule-meta">
                        ${item.analysis_type ? `${item.analysis_type} Analysis` : 'Blood Analysis'} • Room ${item.room?.room_number || 'Unassigned'}
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderActivity(activity) {
        const activityLoader = document.getElementById('activityLoader');
        const activityFeed = document.getElementById('activityFeed');
        const activityEmpty = document.getElementById('activityEmpty');
        const activityCount = document.getElementById('activityCount');

        if (activity.length === 0) {
            showActivityEmpty();
            return;
        }

        // Hide loader and empty state
        if (activityLoader) activityLoader.style.display = 'none';
        if (activityEmpty) activityEmpty.style.display = 'none';
        if (activityFeed) activityFeed.style.display = 'block';

        // Update activity count
        if (activityCount) {
            activityCount.textContent = activity.length;
        }

        // Render activity items
        if (activityFeed) {
            activityFeed.innerHTML = activity.slice(0, 10).map(item => `
                <div class="activity-item">
                    <div class="activity-icon ${getActivityType(item.event_type)}">
                        <span class="material-symbols-outlined">${getActivityIcon(item.event_type)}</span>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">
                            ${getActivityTitle(item)}
                        </div>
                        <div class="activity-time">
                            ${formatRelativeTime(item.created_at)}
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    function setupCharts() {
        setupPerformanceChart();
        setupAnalysisTypesChart();
    }

    function setupPerformanceChart() {
        const canvas = document.getElementById('performanceChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Use real data from analyses when available
        const labels = getLast7Days();
        const analyses = dashboardData.metrics.analyses || [];
        
        // Calculate real data for the last 7 days
        const completedData = [];
        const pendingData = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toDateString();
            
            const dayAnalyses = analyses.filter(a => 
                new Date(a.analysis_date).toDateString() === dateStr
            );
            
            const completed = dayAnalyses.filter(a => a.status?.toLowerCase() === 'completed').length;
            const pending = dayAnalyses.filter(a => 
                a.status?.toLowerCase() === 'pending' || 
                a.status?.toLowerCase() === 'delayed'
            ).length;
            
            completedData.push(completed);
            pendingData.push(pending);
        }

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Completed',
                    data: completedData,
                    borderColor: '#28c76f',
                    backgroundColor: 'rgba(40, 199, 111, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }, {
                    label: 'Pending',
                    data: pendingData,
                    borderColor: '#ff9f43',
                    backgroundColor: 'rgba(255, 159, 67, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#f0f0f0'
                        },
                        ticks: {
                            color: '#6c757d'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#6c757d'
                        }
                    }
                },
                elements: {
                    point: {
                        radius: 4,
                        hoverRadius: 6
                    }
                }
            }
        });
    }

    function setupAnalysisTypesChart() {
        const canvas = document.getElementById('analysisTypesChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Use real analysis data to build the chart
        const analyses = dashboardData.metrics.analyses || [];
        
        // Group analyses by type
        const typeCounts = {};
        const typeNames = {
            'XY': 'XY Analysis',
            'YZ': 'YZ Analysis', 
            'ZG': 'ZG Analysis',
            'HG': 'HG Analysis'
        };
        
        analyses.forEach(analysis => {
            const type = analysis.analysis_type;
            if (type) {
                const displayName = typeNames[type] || `${type} Analysis`;
                typeCounts[displayName] = (typeCounts[displayName] || 0) + 1;
            }
        });
        
        const sortedTypes = Object.entries(typeCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 6); // Show top 6 types
            
        const labels = sortedTypes.map(([type]) => type);
        const values = sortedTypes.map(([,count]) => count);
        
        // Brand colors for the chart
        const colors = ['#667eea', '#f093fb', '#4facfe', '#fa709a', '#28c76f', '#ff9f43'];
        
        if (labels.length === 0) {
            // Show empty state
            const summaryEl = document.getElementById('analysisSummary');
            if (summaryEl) {
                summaryEl.innerHTML = `
                    <div class="empty-chart">
                        <span class="material-symbols-outlined">pie_chart</span>
                        <p>No analysis data available</p>
                    </div>
                `;
            }
            return;
        }

        const data = {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 0
            }]
        };

        new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                cutout: '60%'
            }
        });

        // Update summary with real data
        const summaryEl = document.getElementById('analysisSummary');
        if (summaryEl && sortedTypes.length > 0) {
            const mostCommon = sortedTypes[0][0];
            const totalTypes = Object.keys(typeCounts).length;
            
            summaryEl.innerHTML = `
                <div class="summary-item">
                    <span class="summary-label">Most Common</span>
                    <span class="summary-value">${mostCommon}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Total Types</span>
                    <span class="summary-value">${totalTypes}</span>
                </div>
            `;
        }
    }

    function toggleScheduleView() {
        scheduleViewMode = scheduleViewMode === 'timeline' ? 'list' : 'timeline';
        
        const timelineEl = document.getElementById('scheduleTimeline');
        const listEl = document.getElementById('scheduleList');
        const toggleBtn = document.getElementById('scheduleViewToggle');

        if (scheduleViewMode === 'timeline') {
            if (timelineEl) timelineEl.style.display = 'block';
            if (listEl) listEl.style.display = 'none';
            if (toggleBtn) {
                toggleBtn.innerHTML = '<span class="material-symbols-outlined">view_list</span>';
                toggleBtn.title = 'Switch to list view';
            }
        } else {
            if (timelineEl) timelineEl.style.display = 'none';
            if (listEl) listEl.style.display = 'block';
            if (toggleBtn) {
                toggleBtn.innerHTML = '<span class="material-symbols-outlined">view_timeline</span>';
                toggleBtn.title = 'Switch to timeline view';
            }
        }

        // Re-render with current data
        if (dashboardData.schedule.length > 0) {
            renderSchedule(dashboardData.schedule);
        }
    }

    async function refreshDashboard() {
        const refreshBtn = document.getElementById('refreshDashboard');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> Refreshing...';
        }

        await loadDashboardData();

        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<span class="material-symbols-outlined">refresh</span> Refresh';
        }

        showNotification('Dashboard refreshed', 'success');
    }

    function startAutoRefresh() {
        // Refresh dashboard every 5 minutes
        refreshInterval = setInterval(() => {
            loadDashboardData();
        }, 5 * 60 * 1000);
    }

    function stopAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    }

    // Utility functions
    function animateNumber(element, targetValue, suffix = '') {
        const startValue = parseInt(element.textContent) || 0;
        const duration = 1000;
        const stepTime = 16;
        const steps = duration / stepTime;
        const stepValue = (targetValue - startValue) / steps;
        
        let currentValue = startValue;
        let step = 0;

        const timer = setInterval(() => {
            currentValue += stepValue;
            step++;
            
            if (step >= steps) {
                currentValue = targetValue;
                clearInterval(timer);
            }
            
            element.textContent = Math.round(currentValue) + suffix;
        }, stepTime);
    }

    function formatTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    function formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    }

    function getLast7Days() {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            days.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        }
        return days;
    }

    function getDateRange() {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);
        
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    }

    function getActivityType(eventType) {
        if (eventType.includes('create')) return 'create';
        if (eventType.includes('update')) return 'update';
        if (eventType.includes('delete')) return 'delete';
        return 'update';
    }

    function getActivityIcon(eventType) {
        if (eventType.includes('create')) return 'add_circle';
        if (eventType.includes('update')) return 'edit';
        if (eventType.includes('delete')) return 'delete';
        if (eventType.includes('login')) return 'login';
        return 'info';
    }

    function getActivityTitle(item) {
        const type = item.event_type || '';
        const target = item.target_type || 'item';
        const userName = item.user_name || 'Someone';
        const metadata = item.metadata || {};
        
        // Analysis events
        if (type.includes('analysis')) {
            const patientName = metadata.patient_name || metadata.patientName || 'Unknown Patient';
            const analysisType = metadata.analysis_type || metadata.analysisType || '';
            
            if (type.includes('created')) {
                return `${userName} scheduled ${analysisType} analysis for ${patientName}`;
            }
            if (type.includes('completed')) {
                return `${userName} completed analysis for ${patientName}`;
            }
            if (type.includes('cancelled')) {
                return `${userName} cancelled analysis for ${patientName}`;
            }
            if (type.includes('postponed')) {
                return `${userName} postponed analysis for ${patientName}`;
            }
            if (type.includes('status_changed')) {
                const newStatus = metadata.new_status || metadata.newStatus || '';
                return `${userName} changed analysis status${newStatus ? ` to ${newStatus}` : ''}`;
            }
        }
        
        // Patient events
        if (type.includes('patient')) {
            const patientName = metadata.patient_name || metadata.name || 'Patient';
            if (type.includes('created')) return `${userName} added new patient: ${patientName}`;
            if (type.includes('updated')) return `${userName} updated patient: ${patientName}`;
            if (type.includes('deleted')) return `${userName} removed patient: ${patientName}`;
        }
        
        // User events
        if (type.includes('user')) {
            const targetUserName = metadata.full_name || metadata.username || 'User';
            if (type.includes('created')) return `${userName} created user account: ${targetUserName}`;
            if (type.includes('updated')) return `${userName} updated user: ${targetUserName}`;
            if (type.includes('locked')) return `${userName} locked user account: ${targetUserName}`;
            if (type.includes('unlocked')) return `${userName} unlocked user account: ${targetUserName}`;
        }
        
        // System events
        if (type.includes('system_update')) {
            const updateTitle = metadata.title || 'System Update';
            if (type.includes('published')) return `${userName} published system update: ${updateTitle}`;
        }
        
        // Generic fallbacks
        if (type.includes('created')) return `${userName} created new ${target}`;
        if (type.includes('updated')) return `${userName} updated ${target}`;
        if (type.includes('deleted')) return `${userName} deleted ${target}`;
        if (type.includes('login')) return `${userName} logged in`;
        
        return `${userName} performed ${type} activity`;
    }

    function showScheduleEmpty() {
        const scheduleLoader = document.getElementById('scheduleLoader');
        const scheduleContent = document.getElementById('scheduleContent');
        const scheduleEmpty = document.getElementById('scheduleEmpty');

        if (scheduleLoader) scheduleLoader.style.display = 'none';
        if (scheduleContent) scheduleContent.style.display = 'none';
        if (scheduleEmpty) scheduleEmpty.style.display = 'block';
    }

    function showActivityEmpty() {
        const activityLoader = document.getElementById('activityLoader');
        const activityFeed = document.getElementById('activityFeed');
        const activityEmpty = document.getElementById('activityEmpty');

        // Only show empty state if activity card exists (admin only)
        if (activityLoader) activityLoader.style.display = 'none';
        if (activityFeed) activityFeed.style.display = 'none';
        if (activityEmpty) activityEmpty.style.display = 'block';
    }

    function showLoadingState() {
        // Show loading states for various components
        console.log('Loading dashboard data...');
    }

    function hideLoadingState() {
        // Hide loading states
        console.log('Dashboard data loaded');
    }

    function showErrorState(message) {
        showNotification(message, 'error');
    }

    function showNotification(message, type = 'info') {
        // Use existing notification system
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        stopAutoRefresh();
    });
});