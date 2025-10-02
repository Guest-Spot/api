import { Button, Modal, Typography } from '@strapi/design-system';
import { useState } from 'react';

const SendEmailButton = () => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleCloseConfirmModal = () => {
    setShowConfirmModal(false);
  };

  const handleConfirmSendEmail = () => {
    setShowConfirmModal(false);
  };

  return (
    <>
      <Button onClick={() => setShowConfirmModal(true)}>Send Email</Button>
      {showConfirmModal && (
        <Modal.Root onClose={handleCloseConfirmModal} open={showConfirmModal}>
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>Confirm Send Email</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Typography>
                Are you sure you want to send the email? This action cannot be undone.
              </Typography>
            </Modal.Body>
            <Modal.Footer>
              <Modal.Close>
                <Button variant="tertiary" onClick={handleCloseConfirmModal}>
                  Cancel
                </Button>
              </Modal.Close>
              <Button onClick={handleConfirmSendEmail}>Confirm</Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal.Root>
      )}
    </>
  );
};

export default SendEmailButton;
