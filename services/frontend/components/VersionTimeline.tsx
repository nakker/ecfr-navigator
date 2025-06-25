import React, { useMemo, useState } from 'react';
import { Box, Typography, Tooltip as MuiTooltip } from '@mui/material';

interface Version {
  date: string;
  identifier: string;
  name: string;
  part: string;
  type: string;
}

interface VersionTimelineProps {
  versions: Version[];
}

export default function VersionTimeline({ versions }: VersionTimelineProps) {
  const [hoveredVersion, setHoveredVersion] = useState<Version | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Process versions and calculate positions
  const processedData = useMemo(() => {
    if (!versions || versions.length === 0) return null;

    // Sort versions by date
    const sortedVersions = [...versions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const firstDate = new Date(sortedVersions[0].date);
    const lastDate = new Date(sortedVersions[sortedVersions.length - 1].date);
    const today = new Date();
    
    // Add 10% padding to the timeline duration for better visualization
    const timeSpan = lastDate.getTime() - firstDate.getTime();
    const padding = timeSpan * 0.1; // 10% padding
    
    // Use last date + padding, but not beyond today
    const endDateWithPadding = new Date(lastDate.getTime() + padding);
    const endDate = endDateWithPadding < today ? endDateWithPadding : today;
    const totalDuration = endDate.getTime() - firstDate.getTime();

    // Group versions by date to handle multiple versions on same day
    const versionsByDate = new Map<string, Version[]>();
    sortedVersions.forEach(version => {
      const dateKey = new Date(version.date).toISOString().split('T')[0];
      if (!versionsByDate.has(dateKey)) {
        versionsByDate.set(dateKey, []);
      }
      versionsByDate.get(dateKey)!.push(version);
    });

    // Calculate positions and identify first date
    const positionedVersions = Array.from(versionsByDate.entries()).map(([dateKey, dateVersions]) => {
      const date = new Date(dateVersions[0].date);
      const position = ((date.getTime() - firstDate.getTime()) / totalDuration) * 100;
      
      return {
        date: dateKey,
        dateObj: date,
        position,
        versions: dateVersions,
        count: dateVersions.length,
        isFirst: date.getTime() === firstDate.getTime()
      };
    });

    // Find max updates on a single day for scaling, treating first day as 1 update
    const maxUpdatesPerDay = Math.max(...positionedVersions.map(v => v.isFirst ? 1 : v.count));

    return {
      firstDate,
      endDate,
      positionedVersions,
      totalVersions: sortedVersions.length,
      maxUpdatesPerDay
    };
  }, [versions]);

  if (!processedData) return null;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <Box 
      ref={containerRef}
      sx={{ 
        position: 'relative', 
        height: '250px',
        width: '100%',
        p: 2
      }}>
      {/* Timeline line */}
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '20px',
        right: '20px',
        height: '2px',
        bgcolor: 'divider',
        transform: 'translateY(-50%)'
      }} />

      {/* Start date label */}
      <Box sx={{
        position: 'absolute',
        top: '60%',
        left: '20px',
        transform: 'translateX(-50%)'
      }}>
        <Typography variant="caption" color="text.secondary">
          {formatDate(processedData.firstDate)}
        </Typography>
      </Box>

      {/* End date label */}
      <Box sx={{
        position: 'absolute',
        top: '60%',
        right: '20px',
        transform: 'translateX(50%)'
      }}>
        <Typography variant="caption" color="text.secondary">
          {formatDate(processedData.endDate)}
        </Typography>
      </Box>

      {/* Version dots */}
      {processedData.positionedVersions.map((item, index) => {
        // Calculate pixel position
        const availableWidth = containerWidth - 40; // 20px padding on each side
        const leftPosition = 20 + (availableWidth * item.position / 100);
        
        // Calculate dot size based on number of updates (min 6px, max 20px)
        const minSize = 6;
        const maxSize = 20;
        // Treat first dot as 1 update for sizing purposes
        const effectiveCount = item.isFirst ? 1 : item.count;
        const sizeRatio = effectiveCount / processedData.maxUpdatesPerDay;
        const dotSize = minSize + (maxSize - minSize) * sizeRatio;
        
        // Determine color based on number of updates
        const getColor = () => {
          const ratio = effectiveCount / processedData.maxUpdatesPerDay;
          if (ratio > 0.7) return 'error.main';
          if (ratio > 0.4) return 'warning.main';
          return 'primary.main';
        };
        
        return (
          <MuiTooltip
            key={item.date}
            title={
              <Box>
                <Typography variant="body2">
                  {formatDate(item.dateObj)}
                </Typography>
                <Typography variant="caption">
                  {item.count} version{item.count > 1 ? 's' : ''} updated
                </Typography>
                {item.versions.slice(0, 3).map((v, i) => (
                  <Typography key={i} variant="caption" display="block" sx={{ mt: 0.5 }}>
                    • {v.identifier}: {v.name.substring(0, 50)}...
                  </Typography>
                ))}
                {item.count > 3 && (
                  <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                    ... and {item.count - 3} more
                  </Typography>
                )}
              </Box>
            }
            placement="top"
            arrow
          >
            <Box
              onMouseEnter={() => setHoveredVersion(item.versions[0])}
              onMouseLeave={() => setHoveredVersion(null)}
              sx={{
                position: 'absolute',
                top: '50%',
                left: `${leftPosition}px`,
                transform: 'translate(-50%, -50%)',
                width: `${dotSize}px`,
                height: `${dotSize}px`,
                borderRadius: '50%',
                bgcolor: getColor(),
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: 0.8,
                '&:hover': {
                  transform: 'translate(-50%, -50%) scale(1.3)',
                  boxShadow: 3,
                  opacity: 1
                },
                zIndex: hoveredVersion === item.versions[0] ? 10 : 1
              }}
            />
          </MuiTooltip>
        );
      })}

      {/* Summary stats */}
      <Box sx={{ 
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        textAlign: 'center'
      }}>
        <Typography variant="caption" color="text.secondary">
          {processedData.totalVersions} total updates across {processedData.positionedVersions.length} days
        </Typography>
      </Box>
    </Box>
  );
}