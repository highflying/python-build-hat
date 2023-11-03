import time
from signal import pause
from buildhat import Motor


print('Getting motor')

motor = Motor('A')
motor.set_default_speed(30)

print("Position", motor.get_position())

def handle_motor(speed, pos, apos):
    print("Motor", speed, pos, apos)

motor.when_rotated = handle_motor

print("Run for degrees")
motor.run_for_degrees(360)

# print("Run for seconds")
# motor.run_for_seconds(5)

# print("Run for rotations")
# motor.run_for_rotations(2)

# print("Start motor")
# motor.start()
# time.sleep(3)
# print("Stop motor")
# motor.stop()

pause()
