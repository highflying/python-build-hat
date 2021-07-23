/* callback.h
 *
 * SPDX-License-Identifier: MIT
 *
 * Copyright (c) 2020 Raspberry Pi (Trading) Limited
 *
 * This file incorporates work covered by the following copyright and
 * permission notice:
 *
 *     Copyright (c) 2020 Kynesim Ltd
 *     Copyright (c) 2017-2020 LEGO System A/S
 *
 * Handling callbacks, using a separate thread.
 */

#ifndef RPI_STRAWBERRY_CALLBACK_H_INCLUDED
#define RPI_STRAWBERRY_CALLBACK_H_INCLUDED

/* Callback type codes */
#define CALLBACK_PORT     0
#define CALLBACK_MOTOR    1
#define CALLBACK_PAIR     2
#define CALLBACK_FIRMWARE 3
#define CALLBACK_ALERT    4
#define CALLBACK_DEVICE   5

/* Event codes for the port callbacks */
#define CALLBACK_DETACHED 0
#define CALLBACK_ATTACHED 1

/* Event codes for the motor/pair callbacks */
#define CALLBACK_COMPLETE    0
#define CALLBACK_INTERRUPTED 1
#define CALLBACK_STALLED     2

/* Event codes for device callback */
#define CALLBACK_DATA 0

/* Initialise and start the callback thread.  Returns zero on success,
 * or a negative number on failure.  If the function fails, it will
 * also set a Python exception.
 */
extern int callback_init(void);

/* Finalize the callback thread.  Does not do much tidying up, but
 * should only be called when we are quitting anyway.
 */
extern int callback_finalize(void);

/* Queue a callback.  Returns zero on success, or a negative number on
 * error.  Since this is called from the receiver thread, no Python
 * exception is raised on error.
 */
extern int callback_queue(uint8_t cb_type,
                          uint8_t port_id,
                          uint8_t event);

#endif /* RPI_STRAWBERRY_CALLBACK_H_INCLUDED */
