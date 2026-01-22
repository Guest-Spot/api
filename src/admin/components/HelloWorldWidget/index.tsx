import React, { useState, useEffect } from 'react';
import { Box, Typography, Flex, Divider } from '@strapi/design-system';
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

  const statCards = [
    { label: 'Pending', value: data.pending, tone: 'warning' },
    { label: 'Accepted', value: data.accepted, tone: 'success' },
    { label: 'Rejected', value: data.rejected, tone: 'danger' },
  ];

  return (
    <Box
      padding={4}
      background="neutral0"
      borderRadius="12px"
      shadow="tableShadow"
      borderWidth="1px"
      borderStyle="solid"
      borderColor="neutral150"
    >
      <Flex justify="space-between" align="flex-start">
        <Flex direction="column" gap={2}>
          <Typography variant="epsilon" textColor="neutral600" textTransform="uppercase">
            Live overview
          </Typography>
          <Typography variant="delta" fontWeight="bold">
            {data.total.toLocaleString()} bookings
          </Typography>
          <Typography textColor="neutral600">
            Track current requests and reactions in one place.
          </Typography>
        </Flex>
        <Box
          padding={2}
          background="primary100"
          borderRadius="8px"
          style={{ minWidth: 80, textAlign: 'center' }}
        >
          <Typography variant="omega" textColor="primary600">
            Total
          </Typography>
          <Typography variant="alpha" fontWeight="bold" textColor="primary700">
            {data.total}
          </Typography>
        </Box>
      </Flex>

      <Divider marginTop={4} marginBottom={4} />

      <Flex gap={3} justify="space-between" wrap="wrap">
        {statCards.map(card => (
          <Box
            key={card.label}
            padding={3}
            background="neutral100"
            borderRadius="10px"
            style={{ flex: '1 1 30%', minWidth: 150 }}
          >
            <Typography variant="omega" textColor="neutral600">
              {card.label}
            </Typography>
            <Typography variant="beta" fontWeight="bold" textColor={`${card.tone}700`}>
              {card.value.toLocaleString()}
            </Typography>
          </Box>
        ))}
      </Flex>
    </Box>
  );
};

export default HelloWorldWidget;
