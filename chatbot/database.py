# import os

# import mysql.connector
# from mysql.connector import Error

# from dotenv import load_dotenv


# load_dotenv()


# def get_db_connection():

#     try:

#         connection = mysql.connector.connect(

#             host=os.getenv("MYSQL_HOST"),

#             port=int(
#                 os.getenv("MYSQL_PORT", 3306)
#             ),

#             user=os.getenv("MYSQL_USER"),

#             password=os.getenv("MYSQL_PASSWORD"),

#             database=os.getenv("MYSQL_DATABASE")
#         )

#         return connection

#     except Error as e:

#         print(f"Database connection error: {e}")

#         return None