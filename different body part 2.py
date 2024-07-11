import cv2
import mediapipe as mp
import random

# Initialize the camera
cap = cv2.VideoCapture(0)

# Setting up pose detection
mpPose = mp.solutions.pose
pose = mpPose.Pose()
mpDraw = mp.solutions.drawing_utils

# Setting up target points
score = 0
x_enemy = random.randint(50, 600)
y_enemy = random.randint(50, 400)

def enemy():
    '''Function that creates random targets'''
    global x_enemy, y_enemy
    cv2.circle(img, (x_enemy, y_enemy), 25, (0, 200, 0), 5)
    print('yes')

# Track which finger to use: 20 for right index finger, 19 for left index finger
use_right_index = True

while True:
    success, img = cap.read()
    if not success:
        break

    # Invert the image
    img = cv2.flip(img, 1)

    imgRGB = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    results = pose.process(imgRGB)

    # Drawing target circles
    font = cv2.FONT_HERSHEY_SIMPLEX
    color = (255, 0, 255)
    cv2.putText(img, "Score", (480, 30), font, 1, color, 4, cv2.LINE_AA)
    cv2.putText(img, str(score), (590, 30), font, 1, color, 4, cv2.LINE_AA)

    enemy()

    if results.pose_landmarks:
        mpDraw.draw_landmarks(img, results.pose_landmarks, mpPose.POSE_CONNECTIONS)
        for id, lm in enumerate(results.pose_landmarks.landmark):
            h, w, c = img.shape
            imageWidth, imageHeight = int(lm.x * w), int(lm.y * h)  # Get x and y coordinates
            cv2.circle(img, (imageWidth, imageHeight), 10, (255, 0, 0), cv2.FILLED)

    # Code to change landmarks and match with point
    if results.pose_landmarks:
        # Determine enemy position 
        if use_right_index:
            index_finger_id = 20
        else:
            index_finger_id = 19

        if y_enemy < img.shape[0] // 2:  # Top half of the screen
            index_finger_id = 20  # Right index finger
        else:  # Bottom half of the screen
            index_finger_id = 19  # Left index finger

        # Get the normalized landmark for the selected index finger
        normalizedLandmark = results.pose_landmarks.landmark[index_finger_id]
        pixelCoordinatesLandmark = mpDraw._normalized_to_pixel_coordinates(normalizedLandmark.x, normalizedLandmark.y, img.shape[1], img.shape[0])
        if pixelCoordinatesLandmark:
            try:
                cv2.circle(img, (pixelCoordinatesLandmark[0], pixelCoordinatesLandmark[1]), 25, (0, 200, 0), 5)
                if pixelCoordinatesLandmark[0] in range(x_enemy - 10, x_enemy + 11):
                    print("found")
                    x_enemy = random.randint(50, 600)
                    y_enemy = random.randint(50, 400)
                    score += 1
                    cv2.putText(img, "Score", (100, 100), font, 1, color, 4, cv2.LINE_AA)
                    enemy()
                    # Toggle to the other index finger
                    use_right_index = not use_right_index
            except Exception as e:
                print(f"Error: {e}")

    cv2.imshow('image', img)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()

