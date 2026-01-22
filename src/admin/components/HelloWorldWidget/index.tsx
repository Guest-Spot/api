import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Flex } from '@strapi/design-system';
import { Widget, useFetchClient } from '@strapi/admin/strapi-admin';

interface BookingStatistics {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
}

const HelloWorldWidget = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BookingStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { get } = useFetchClient();

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        const { data: result } = await get('/api/bookings/statistics');
        setData(result.data);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      }
    };

    fetchStatistics();
  }, [get]);

  if (loading) {
    return <Widget.Loading />;
  }

  if (error) {
    return <Widget.Error>{error}</Widget.Error>;
  }

  if (!data) {
    return <Widget.NoData>No booking data available</Widget.NoData>;
  }

  return (
    <Box padding={4}>
      <Grid.Root gap={4}>
        <Grid.Item col={12}>
          <Flex direction="column" gap={2}>
            <Typography variant="beta" fontWeight="bold">
              Total Bookings: {data.total}
            </Typography>
          </Flex>
        </Grid.Item>
        <Grid.Item col={4}>
          <Box padding={3} background="neutral100" borderRadius="4px">
            <Typography variant="omega" textColor="neutral600">
              Pending
            </Typography>
            <Typography variant="alpha" fontWeight="bold">
              {data.pending}
            </Typography>
          </Box>
        </Grid.Item>
        <Grid.Item col={4}>
          <Box padding={3} background="neutral100" borderRadius="4px">
            <Typography variant="omega" textColor="neutral600">
              Accepted
            </Typography>
            <Typography variant="alpha" fontWeight="bold">
              {data.accepted}
            </Typography>
          </Box>
        </Grid.Item>
        <Grid.Item col={4}>
          <Box padding={3} background="neutral100" borderRadius="4px">
            <Typography variant="omega" textColor="neutral600">
              Rejected
            </Typography>
            <Typography variant="alpha" fontWeight="bold">
              {data.rejected}
            </Typography>
          </Box>
        </Grid.Item>
      </Grid.Root>
    </Box>
  );
};

export default HelloWorldWidget;
